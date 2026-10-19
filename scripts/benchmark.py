"""Real local pipeline benchmark with synthetic speech; no browser/audio-device claims."""

import argparse
import asyncio
import base64
import io
import json
import statistics
import sys
import time
import wave
from pathlib import Path

import numpy as np
from account_session import session_cookie
from piper import PiperVoice
from websockets.asyncio.client import connect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

PROMPTS = [
    "My name is Mira. Please remember it.", "What is my name?",
    "What makes the sky blue?", "Give me one tip for a job interview.",
    "What is photosynthesis?", "Tell me a short fun fact about space.",
    "How can I stay focused while studying?", "What is an open weight model?",
    "Suggest a simple way to relax.", "What is the difference between weather and climate?",
]


def make_pcm(voice, text):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        voice.synthesize_wav(text, wav)
    with wave.open(io.BytesIO(output.getvalue()), "rb") as wav:
        data = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
        rate = wav.getframerate()
    resampled = np.interp(
        np.arange(round(len(data) * 16000 / rate)) * rate / 16000,
        np.arange(len(data)), data,
    ).astype("<i2")
    return resampled.tobytes()


def make_mixed_pcm(english, hindi, text):
    from app.core import speech_parts

    return b"".join(make_pcm(hindi if is_hindi else english, part)
                    for is_hindi, part in speech_parts(text))


async def run(count, output):
    voice = PiperVoice.load(str(ROOT / "models/en_US-lessac-medium.onnx"))
    fixtures = [make_pcm(voice, text) for text in PROMPTS[:count]]
    output.parent.mkdir(exist_ok=True, parents=True)
    # A reusable fake-microphone WAV: silence, spoken prompt, then silence.
    with wave.open(str(output.parent / "microphone-fixture.wav"), "wb") as wav:
        wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        wav.writeframes(bytes(64000) + fixtures[0] + bytes(64000))
    rows = []
    async with connect(
        "ws://127.0.0.1:8000/ws/conversation", origin="http://127.0.0.1:8000",
        max_size=4_000_000, additional_headers={"Cookie": await session_cookie()},
    ) as ws:
        for turn, (prompt, pcm) in enumerate(zip(PROMPTS, fixtures, strict=False), 1):
            started = time.perf_counter()
            await ws.send(json.dumps({
                "type": "speech", "turn_id": turn, "pcm": base64.b64encode(pcm).decode(),
            }))
            row = {"prompt": prompt, "transcript": "", "response": ""}
            while True:
                event = json.loads(await asyncio.wait_for(ws.recv(), timeout=120))
                kind = event["type"]
                if kind == "transcript":
                    row["transcript"] = event["text"]
                elif kind == "text_delta":
                    row["response"] += event["text"]
                elif kind == "audio":
                    row.setdefault(
                        "first_audio_received_ms", (time.perf_counter() - started) * 1000
                    )
                    await ws.send(json.dumps({
                        "type": "played", "turn_id": turn, "index": event["index"],
                    }))
                elif kind == "turn_done":
                    row.update(event["metrics"])
                    break
                elif kind in {"error", "empty"}:
                    raise RuntimeError(event)
            rows.append(row)
            print(
                f'{turn}: {row["first_audio_received_ms"]:.0f}ms | {row["transcript"]}',
                flush=True,
            )
    summary = {}
    for key in ["stt_ms", "first_text_ms", "first_audio_received_ms", "server_total_ms"]:
        values = sorted(row[key] for row in rows)
        summary[key] = {
            "median": round(statistics.median(values), 1),
            "p95": round(values[min(len(values) - 1, int(np.ceil(len(values) * 0.95)) - 1)], 1),
        }
    output.write_text(json.dumps({
        "method": "Synthetic Piper prompts; real STT/LLM/TTS; immediate headless audio acks. "
        "Excludes microphone VAD, actual playback, and endpoint delay. Not acoustic latency.",
        "summary": summary, "turns": rows,
    }, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--turns", type=int, choices=range(1, 11), default=10)
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/benchmark.json")
    args = parser.parse_args()
    asyncio.run(run(args.turns, args.output))

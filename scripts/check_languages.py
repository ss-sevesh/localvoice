"""Synthetic speech through real local STT/LLM/TTS; inspect language-matching results."""

import asyncio
import base64
import io
import json
import re
import wave

from account_session import session_cookie
from benchmark import ROOT, make_mixed_pcm
from make_fixtures import HINDI_PROMPT, HINGLISH_PROMPT
from piper import PiperVoice
from websockets.asyncio.client import connect

CASES = [
    ("english", "My name is Mira. Please remember it.", "en"),
    ("hindi", HINDI_PROMPT, "hi"),
    ("hinglish", HINGLISH_PROMPT, "mixed"),
    ("english-switch", "Give me one tip for sleeping better.", "en"),
    ("override", "मुझे एक सलाह दो। जवाब English में देना।", "en"),
]


async def run():
    english = PiperVoice.load(str(ROOT / "models/en_US-lessac-medium.onnx"))
    hindi = PiperVoice.load(str(ROOT / "models/hi_IN-pratham-medium.onnx"))
    results = []
    async with connect(
        "ws://127.0.0.1:8000/ws/conversation", origin="http://127.0.0.1:8000",
        max_size=4_000_000, additional_headers={"Cookie": await session_cookie()},
    ) as ws:
        for turn, (name, prompt, expected) in enumerate(CASES, 1):
            pcm = make_mixed_pcm(english, hindi, prompt)
            if name in {"hindi", "hinglish"}:
                with wave.open(str(ROOT / "artifacts" / f"{name}-microphone.wav"), "wb") as wav:
                    wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
                    wav.writeframes(bytes(64000) + pcm + bytes(96000))
            await ws.send(json.dumps({
                "type": "speech", "turn_id": turn, "pcm": base64.b64encode(pcm).decode(),
            }))
            row = {"case": name, "prompt": prompt, "expected": expected,
                   "transcript": "", "response": "", "audio_chunks": 0}
            while True:
                event = json.loads(await asyncio.wait_for(ws.recv(), 120))
                if event["type"] == "transcript":
                    row["transcript"] = event["text"]
                elif event["type"] == "text_delta":
                    row["response"] += event["text"]
                elif event["type"] == "audio":
                    audio = base64.b64decode(event["wav"])
                    with wave.open(io.BytesIO(audio), "rb") as wav:
                        assert wav.getnframes() > 0
                    (ROOT / "artifacts" / f"{name}-reply-{event['index']}.wav").write_bytes(audio)
                    row["audio_chunks"] += 1
                    await ws.send(json.dumps({
                        "type": "played", "turn_id": turn, "index": event["index"],
                    }))
                elif event["type"] == "turn_done":
                    row["metrics"] = event["metrics"]
                    break
                elif event["type"] in {"error", "empty"}:
                    raise RuntimeError(event)
            has_hindi = any("\u0900" <= c <= "\u097f" and c.isalpha() for c in row["response"])
            has_english = bool(re.search(r"[a-zA-Z]{2,}", row["response"]))
            row["script_check"] = (
                has_hindi and has_english if expected == "mixed"
                else has_hindi and not has_english if expected == "hi"
                else has_english and not has_hindi
            )
            results.append(row)
            print(json.dumps(row, ensure_ascii=True), flush=True)
    (ROOT / "artifacts/language-check.json").write_text(
        json.dumps({"method": "Synthetic Piper speech; actual local inference; headless audio "
                    "acknowledgements. Script checks are a smoke test, not linguistic evaluation.",
                    "turns": results}, ensure_ascii=False, indent=2), encoding="utf-8",
    )
    assert all(r["script_check"] and r["audio_chunks"] for r in results), results


if __name__ == "__main__":
    asyncio.run(run())

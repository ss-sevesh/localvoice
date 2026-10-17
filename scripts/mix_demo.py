"""Align the actual captured playback buffers and synthetic microphone with demo video."""

import base64
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "artifacts/demo"
RATE = 48000


def add(track, samples, rate, start):
    samples = np.interp(
        np.arange(round(len(samples) * RATE / rate)) * rate / RATE,
        np.arange(len(samples)), samples,
    )
    offset = max(0, round(start * RATE))
    length = min(len(samples), len(track) - offset)
    if length > 0:
        track[offset:offset + length] += samples[:length]


if __name__ == "__main__":
    capture = json.loads((DEMO / "audio-events.json").read_text())
    track = np.zeros(RATE * capture["duration"], dtype=np.float32)
    stops = {e["id"]: e["at"] for e in capture["events"] if e["type"] == "stop"}
    for event in capture["events"]:
        start = (event["at"] - capture["started"]) / 1000
        if event["type"] == "start":
            samples = np.frombuffer(base64.b64decode(event["pcm"]), dtype="<f4")
            if event["id"] in stops:
                samples = samples[:max(0, round(
                    (stops[event["id"]] - event["at"]) * event["rate"] / 1000
                ))]
            add(track, samples, event["rate"], start)
        elif event["type"] == "microphone":
            with wave.open(str(ROOT / "artifacts/demo-microphone.wav"), "rb") as wav:
                samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2") / 32768
                add(track, samples, wav.getframerate(), start)
    with wave.open(str(DEMO / "audio.wav"), "wb") as wav:
        wav.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        wav.writeframes((np.clip(track, -1, 1) * 32767).astype("<i2").tobytes())
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(DEMO / "browser.webm"),
        "-i", str(DEMO / "audio.wav"),
        "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-t", str(capture["duration"]), "-movflags", "+faststart",
        str(ROOT / "artifacts/local-voice-demo.mp4"),
    ], check=True)

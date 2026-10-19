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
    if len(samples) == 0:
        return
    samples = np.interp(
        np.arange(round(len(samples) * RATE / rate)) * rate / RATE,
        np.arange(len(samples)),
        samples,
    )
    offset = round(start * RATE)
    if offset < 0:
        samples = samples[-offset:]
        offset = 0
    length = min(len(samples), len(track) - offset)
    if length > 0:
        track[offset : offset + length] += samples[:length]


def read_wav(path):
    with wave.open(str(path), "rb") as wav:
        assert wav.getsampwidth() == 2 and wav.getnchannels() == 1
        return np.frombuffer(
            wav.readframes(wav.getnframes()), dtype="<i2"
        ) / 32768, wav.getframerate()


def voice_level(samples):
    active = samples[np.abs(samples) > 0.01]
    assert len(active), "A voice track is silent."
    gain = min(3, 0.15 / np.sqrt(np.mean(active**2)))
    return samples * gain


def reply_track(capture, duration, offset=0):
    track = np.zeros(round(RATE * duration), dtype=np.float32)
    stops = {e["id"]: e["at"] for e in capture["events"] if e["type"] == "stop"}
    for event in capture["events"]:
        start = (event["at"] - capture["started"]) / 1000 + offset
        if event["type"] == "start":
            samples = np.frombuffer(base64.b64decode(event["pcm"]), dtype="<f4")
            if event["id"] in stops:
                samples = samples[
                    : max(0, round((stops[event["id"]] - event["at"]) * event["rate"] / 1000))
                ]
            add(track, samples, event["rate"], start)
    return track


def marker_offset(lines, marker_time):
    timestamp = 0
    marker = None
    bright = False
    for line in lines:
        if "pts_time:" in line:
            timestamp = float(line.split("pts_time:")[1])
        elif "lavfi.signalstats.YAVG=" in line:
            current = float(line.split("=")[1]) > 200
            if current and not bright:
                marker = timestamp
            bright = current
    if marker is None:
        raise ValueError("The audio/video synchronization marker was not recorded.")
    return marker - marker_time


def main():
    capture = json.loads((DEMO / "audio-events.json").read_text(encoding="utf-8"))
    video = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(DEMO / "browser.webm"),
            ]
        )
    )
    duration = float(video["format"]["duration"])
    assert 120 <= duration <= 180
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(DEMO / "browser.webm"),
            "-t",
            "5",
            "-an",
            "-vf",
            "crop=16:16:iw-16:ih-16,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=sync.txt",
            "-f",
            "null",
            "-",
        ],
        cwd=DEMO,
        check=True,
    )
    offset = marker_offset(
        (DEMO / "sync.txt").read_text().splitlines(),
        (capture["syncAt"] - capture["started"]) / 1000,
    )
    assert abs(offset) < 2, f"Unexpected recording clock offset: {offset}"
    assistant = voice_level(reply_track(capture, duration, offset))
    microphone = np.zeros_like(assistant)
    starts = [e for e in capture["events"] if e["type"] == "microphone"]
    assert len(starts) == 1
    samples, rate = read_wav(ROOT / "artifacts/demo-microphone.wav")
    add(
        microphone,
        voice_level(samples),
        rate,
        (starts[0]["at"] - capture["started"]) / 1000 + offset,
    )
    narration = np.zeros_like(assistant)
    for clip in capture["narration"]:
        samples, rate = read_wav(DEMO / clip["file"])
        add(narration, voice_level(samples), rate, clip["start"] + offset)
    assert not np.any((np.abs(narration) > 0.01) & (np.abs(assistant) > 0.01)), (
        "Narration overlaps a reply."
    )
    assert not np.any((np.abs(narration) > 0.01) & (np.abs(microphone) > 0.01)), (
        "Narration overlaps a question."
    )
    track = microphone + assistant + narration
    peak = float(np.max(np.abs(track)))
    if peak > 0.95:
        track *= 0.95 / peak
    with wave.open(str(DEMO / "audio.wav"), "wb") as wav:
        wav.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        wav.writeframes((np.clip(track, -1, 1) * 32767).astype("<i2").tobytes())
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(DEMO / "browser.webm"),
            "-i",
            str(DEMO / "audio.wav"),
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-vf",
            "drawbox=x=iw-16:y=ih-16:w=16:h=16:color=0x100d1e:t=fill",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-ar",
            "48000",
            "-t",
            str(duration),
            "-movflags",
            "+faststart",
            str(ROOT / "artifacts/local-voice-demo.mp4"),
        ],
        check=True,
    )
    checks = {
        "duration": duration,
        "video_clock_offset_seconds": offset,
        "tracks": {
            name: {
                "peak": float(np.max(np.abs(samples))),
                "active_seconds": float(np.count_nonzero(np.abs(samples) > 0.01) / RATE),
            }
            for name, samples in [
                ("microphone", microphone),
                ("assistant", assistant),
                ("narration", narration),
            ]
        },
    }
    (DEMO / "audio-check.json").write_text(json.dumps(checks, indent=2), encoding="utf-8")
    print(json.dumps(checks, indent=2))


if __name__ == "__main__":
    main()

"""Short bilingual demo inputs and narration; assistant replies are never scripted."""

import json
import wave

from benchmark import ROOT, make_pcm
from piper import PiperVoice

NARRATION = [
    (
        0,
        "Meet Local Voice: a private voice companion for English and Hindi. "
        "This demo uses synthetic microphone speech and real local replies.",
    ),
    (10, "I will use short, simple questions. Listen to both the input voice and the assistant."),
    (
        98,
        "The timing panel shows the delay for the last turn. "
        "These are browser measurements, not a microphone to speaker lab test.",
    ),
    (
        111,
        "The flow is simple. Silero detects speech. Whisper turns speech into text. "
        "Qwen writes the reply. Kokoro speaks it.",
    ),
    (
        125,
        "This laptop has an Intel i seven, sixteen gigabytes of memory, "
        "and an RTX forty sixty with eight gigabytes of video memory.",
    ),
    (
        139,
        "You saw English, Hindi, live text, voice detection, "
        "and an interruption. Source code, setup, and model details are on GitHub.",
    ),
]


def write_wav(path, pcm):
    with wave.open(str(path), "wb") as output:
        output.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        output.writeframes(pcm)


def main():
    directory = ROOT / "artifacts/demo"
    directory.mkdir(parents=True, exist_ok=True)
    english = PiperVoice.load(str(ROOT / "models/en_US-lessac-medium.onnx"))
    hindi = PiperVoice.load(str(ROOT / "models/hi_IN-pratham-medium.onnx"))
    prompts = [
        (2, "English greeting", english, "Hello. My name is Sam. Please remember it."),
        (16, "English memory", english, "What is my name?"),
        (30, "Hindi greeting", hindi, "नमस्ते। आप कैसे हैं?"),
        (46, "Hindi memory", hindi, "मेरा नाम क्या है? हिंदी में बताइए।"),
        (62, "Before interruption", english, "Tell me a short story about a cat."),
    ]
    microphone = bytearray(32000 * 80)
    utterances = []
    for start, label, voice, text in prompts:
        pcm = make_pcm(voice, text)
        assert any(pcm) and len(pcm) / 32000 < 10
        offset = round(start * 32000)
        microphone[offset : offset + len(pcm)] = pcm
        utterances.append(
            {"start": start, "duration": len(pcm) / 32000, "label": label, "text": text}
        )
    start = utterances[-1]["start"] + utterances[-1]["duration"] + 5
    text = "No, wait. Just say hello."
    pcm = make_pcm(english, text)
    offset = round(start * 16000) * 2
    assert offset + len(pcm) < len(microphone)
    microphone[offset : offset + len(pcm)] = pcm
    utterances.append(
        {"start": start, "duration": len(pcm) / 32000, "label": "Spoken interruption", "text": text}
    )
    write_wav(ROOT / "artifacts/demo-microphone.wav", microphone)
    narration = []
    for index, (start, text) in enumerate(NARRATION):
        pcm = make_pcm(english, text)
        limit = NARRATION[index + 1][0] if index + 1 < len(NARRATION) else 150
        assert start + len(pcm) / 32000 < limit, (start, len(pcm) / 32000)
        name = f"narration-{index}.wav"
        write_wav(directory / name, pcm)
        narration.append({"start": start, "file": name, "text": text, "duration": len(pcm) / 32000})
    assert narration[1]["start"] + narration[1]["duration"] < 18
    manifest = {
        "duration": 150,
        "microphone_start": 18,
        "utterances": utterances,
        "narration": narration,
    }
    (directory / "script.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("Demo inputs ready: six simple utterances, English/Hindi voices, six narration clips.")


if __name__ == "__main__":
    main()

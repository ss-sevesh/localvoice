"""Synthetic microphone fixtures for reproducible Chrome integration tests."""

import wave
from pathlib import Path

from benchmark import make_mixed_pcm, make_pcm
from piper import PiperVoice

ROOT = Path(__file__).resolve().parents[1]
HINDI_PROMPT = "मेरा नाम क्या है? हिंदी में बताइए।"
# Hindi spelling lets the synthetic Hindi voice pronounce these English loanwords.
HINGLISH_PROMPT = "मेरा जॉब इंटरव्यू कल है, प्लीज़ मुझे एक सिंपल टिप दो।"


def write_fixture(name, parts):
    with wave.open(str(ROOT / "artifacts" / name), "wb") as wav:
        wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        for part in parts:
            wav.writeframes(bytes(32000 * part) if isinstance(part, int) else part)


if __name__ == "__main__":
    (ROOT / "artifacts").mkdir(exist_ok=True)
    voice = PiperVoice.load(str(ROOT / "models/en_US-lessac-medium.onnx"))
    hindi_voice = PiperVoice.load(str(ROOT / "models/hi_IN-pratham-medium.onnx"))
    write_fixture("hindi-microphone.wav", [2, make_pcm(hindi_voice, HINDI_PROMPT), 3])
    write_fixture("hinglish-microphone.wav", [
        2, make_mixed_pcm(voice, hindi_voice, HINGLISH_PROMPT), 3,
    ])
    write_fixture("microphone-fixture.wav", [
        2, make_pcm(voice, "My name is Mira. Please remember it."), 3,
    ])
    write_fixture("interruption-fixture.wav", [
        # Original timing: interrupt playback without accommodating slow recognition.
        2, make_pcm(voice, "Explain how neural networks learn."), 5,
        make_pcm(voice, "Actually, just tell me one fact about cats."), 4,
    ])
    for language, interruption_voice, text in [
        ("english", voice, "No, wait."), ("hindi", hindi_voice, "नहीं, सुनो।"),
    ]:
        write_fixture(f"interruption-short-{language}.wav", [
            2, make_pcm(voice, "Explain how neural networks learn."), 5,
            make_pcm(interruption_voice, text), 4,
        ])
    write_fixture("demo-microphone.wav", [
        2, make_pcm(voice, "My name is Mira and I love hiking. Please remember that."), 12,
        make_pcm(voice, "What is my name and what do I enjoy?"), 12,
        make_pcm(voice, "Explain how neural networks learn."), 5,
        make_pcm(voice, "Actually, just tell me one fact about cats."), 45,
    ])
    print("Synthetic browser microphone fixtures ready.")

"""Fixed synthetic inputs for browser playback latency, never user recordings."""

import json
import wave

from benchmark import ROOT, make_pcm
from piper import PiperVoice

PROMPTS = {
    "english": [
        "Please tell me one fact about cats.", "How can I focus on my work today?",
        "Please explain photosynthesis simply.", "Why does the sky look blue?",
        "Give me a simple tip for studying.", "How do I prepare for an interview?",
        "What is the difference between weather and climate?",
        "Suggest a simple way to relax today.", "Why is drinking water important?",
        "Tell me something interesting about the moon.",
    ],
    "hindi": [
        "मुझे बिल्लियों के बारे में एक बात बताओ।", "मैं आज अपना काम कैसे पूरा करूँ?",
        "पौधे अपना खाना कैसे बनाते हैं?", "आसमान नीला क्यों दिखता है?",
        "मुझे पढ़ाई के लिए एक सुझाव दो।", "मुझे अच्छी नींद कैसे आएगी?",
        "मौसम रोज क्यों बदलता है?", "तनाव कम करने का एक तरीका बताओ।",
        "पानी पीना क्यों जरूरी है?", "मुझे चाँद के बारे में कुछ बताओ।",
    ],
    "hinglish": [
        "मेरा जॉब इंटरव्यू कल है, एक सिंपल टिप दो।",
        "मेरी मीटिंग है, प्लीज़ एक टिप दो।", "मेरे प्रोजेक्ट के लिए एक आइडिया दो।",
        "मुझे स्टडी के लिए एक सिंपल टिप दो।", "मेरी टीम के लिए एक अच्छी टिप दो।",
        "मुझे अपना टाइम मैनेज करना है, हेल्प करो।",
        "मेरा एग्जाम कल है, कोई स्टडी टिप दो।", "मैं एक नई स्किल सीखना चाहता हूँ।",
        "मुझे अपने काम पर फोकस करना है, टिप दो।", "मेरा ऑफिस आज बहुत बिजी है, हेल्प करो।",
    ],
}


def main():
    directory = ROOT / "artifacts/latency"
    directory.mkdir(parents=True, exist_ok=True)
    voices = {
        "english": PiperVoice.load(str(ROOT / "models/en_US-lessac-medium.onnx")),
        "hindi": PiperVoice.load(str(ROOT / "models/hi_IN-pratham-medium.onnx")),
    }
    rows = []
    for language, prompts in PROMPTS.items():
        for index, prompt in enumerate(prompts):
            voice = voices["english" if language == "english" else "hindi"]
            pcm = make_pcm(voice, prompt)
            if len(pcm) < 64000:
                prefix = (
                    "Here is my question. " if language == "english"
                    else "मेरे एक सवाल का जवाब दो। "
                )
                prompt = prefix + prompt
                pcm = make_pcm(voice, prompt)
            assert 2 <= len(pcm) / 32000 <= 8, (language, prompt)
            name = f"{language}-{index + 1}.wav"
            with wave.open(str(directory / name), "wb") as output:
                output.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
                output.writeframes(bytes(64000) + pcm + bytes(128000))
            rows.append({"language": language, "prompt": prompt, "file": name,
                         "input_seconds": round(len(pcm) / 32000, 3)})
    (directory / "fixtures.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8",
    )
    print(f"{len(rows)} synthetic latency fixtures ready.")


if __name__ == "__main__":
    main()

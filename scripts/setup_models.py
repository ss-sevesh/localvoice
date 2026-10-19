"""Explicit download step; normal application startup never downloads models."""

import hashlib
import shutil
from pathlib import Path

import httpx
from huggingface_hub import hf_hub_download, snapshot_download

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"

def setup_kokoro():
    directory = MODELS / "kokoro"
    directory.mkdir(parents=True, exist_ok=True)
    for name, digest in {
        "kokoro-v1.0.onnx": "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
        "kokoro-v1.0.int8.onnx": "6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb",
        "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
    }.items():
        target = directory / name
        if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == digest:
            continue
        temporary = target.with_suffix(target.suffix + ".part")
        checksum = hashlib.sha256()
        with httpx.stream(
            "GET", "https://github.com/thewh1teagle/kokoro-onnx/releases/download/"
            f"model-files-v1.0/{name}", follow_redirects=True, timeout=120,
        ) as response:
            response.raise_for_status()
            with temporary.open("wb") as output:
                for chunk in response.iter_bytes():
                    checksum.update(chunk)
                    output.write(chunk)
        if checksum.hexdigest() != digest:
            raise ValueError(f"Kokoro checksum mismatch: {name}. Retry setup.")
        temporary.replace(target)


if __name__ == "__main__":
    MODELS.mkdir(exist_ok=True)
    setup_kokoro()
    snapshot_download(
        "Systran/faster-whisper-medium",
        revision="08e178d48790749d25932bbc082711ddcfdfbc4f",
        local_dir=MODELS / "whisper-medium",
        allow_patterns=["*.json", "*.bin", "*.txt"],
    )
    snapshot_download(
        "Systran/faster-whisper-small",
        revision="536b0662742c02347bc0e980a01041f333bce120",
        local_dir=MODELS / "whisper-small",
        allow_patterns=["*.json", "*.bin", "*.txt"],
    )
    for name in ["en_US-lessac-medium.onnx", "en_US-lessac-medium.onnx.json", "MODEL_CARD"]:
        cached = hf_hub_download(
            "rhasspy/piper-voices", f"en/en_US/lessac/medium/{name}",
            revision="c10ece1aade47bb51c153c893d14e5bf8e5b7117",
        )
        shutil.copyfile(cached, MODELS / name)
    for name in ["hi_IN-pratham-medium.onnx", "hi_IN-pratham-medium.onnx.json", "MODEL_CARD"]:
        cached = hf_hub_download(
            "rhasspy/piper-voices", f"hi/hi_IN/pratham/medium/{name}",
            revision="c10ece1aade47bb51c153c893d14e5bf8e5b7117",
        )
        target = "hi_IN-pratham-MODEL_CARD" if name == "MODEL_CARD" else name
        shutil.copyfile(cached, MODELS / target)
    print("Speech models ready. Ollama model: qwen3:4b-instruct-2507-q4_K_M")

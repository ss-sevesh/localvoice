"""Explicit download step; normal application startup never downloads models."""

import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download, snapshot_download

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"

if __name__ == "__main__":
    MODELS.mkdir(exist_ok=True)
    snapshot_download(
        "Systran/faster-whisper-base.en",
        revision="3d3d5dee26484f91867d81cb899cfcf72b96be6c",
        local_dir=MODELS / "whisper-base.en",
        allow_patterns=["*.json", "*.bin", "*.txt"],
    )
    for name in ["en_US-lessac-medium.onnx", "en_US-lessac-medium.onnx.json", "MODEL_CARD"]:
        cached = hf_hub_download(
            "rhasspy/piper-voices", f"en/en_US/lessac/medium/{name}",
            revision="c10ece1aade47bb51c153c893d14e5bf8e5b7117",
        )
        shutil.copyfile(cached, MODELS / name)
    print("Speech models ready. Ollama model: qwen3.5:2b-q4_K_M")

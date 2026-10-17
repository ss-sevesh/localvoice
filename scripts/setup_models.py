"""Explicit download step; normal application startup never downloads models."""

import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download, snapshot_download

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"

if __name__ == "__main__":
    MODELS.mkdir(exist_ok=True)
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    snapshot_download(
        "Systran/faster-whisper-base.en",
        local_dir=MODELS / "whisper-base.en",
        allow_patterns=["*.json", "*.bin", "*.txt"],
    )
    for name in ["en_US-lessac-medium.onnx", "en_US-lessac-medium.onnx.json", "MODEL_CARD"]:
        cached = hf_hub_download(
            "rhasspy/piper-voices", f"en/en_US/lessac/medium/{name}"
        )
        shutil.copyfile(cached, MODELS / name)
    print("Speech models ready. Ollama model: qwen3.5:2b-q4_K_M")

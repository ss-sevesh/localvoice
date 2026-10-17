"""Local inference only. Single-worker executors serialize non-cancellable native calls."""

import asyncio
import io
import json
import os
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODEL_NAME = os.getenv("OLLAMA_MODEL", "qwen3.5:2b-q4_K_M")
OLLAMA_URL = "http://127.0.0.1:11434"
VOICE_PATH = ROOT / "models/en_US-lessac-medium.onnx"
WHISPER_PATH = ROOT / "models/whisper-base.en"


class Models:
    def __init__(self):
        self.stt_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="stt")
        self.tts_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tts")
        self.ready = False
        self.error: str | None = None
        self.load_seconds = 0.0
        self.client = httpx.AsyncClient(base_url=OLLAMA_URL, timeout=120)

    async def load(self):
        started = time.perf_counter()
        try:
            await asyncio.get_running_loop().run_in_executor(self.stt_pool, self._load_stt)
            await asyncio.get_running_loop().run_in_executor(self.tts_pool, self._load_tts)
            response = await self.client.post(
                "/api/chat",
                json={
                    "model": MODEL_NAME,
                    "messages": [{"role": "user", "content": "Say ready."}],
                    "think": False,
                    "stream": False,
                    "keep_alive": "30m",
                    "options": {"num_predict": 4, "num_ctx": 4096},
                },
            )
            response.raise_for_status()
            self.ready = True
        except Exception as exc:
            self.error = f"{type(exc).__name__}: {exc}. Run model setup and check Ollama."
        finally:
            self.load_seconds = round(time.perf_counter() - started, 3)

    def _load_stt(self):
        from faster_whisper import WhisperModel

        if not WHISPER_PATH.is_dir():
            raise FileNotFoundError("Whisper missing: run python scripts/setup_models.py")
        self.whisper = WhisperModel(
            str(WHISPER_PATH), device="cpu", compute_type="int8", cpu_threads=6,
            local_files_only=True,
        )
        list(self.whisper.transcribe(np.zeros(1600, dtype=np.float32), language="en")[0])

    def _load_tts(self):
        from piper import PiperVoice

        if not VOICE_PATH.is_file():
            raise FileNotFoundError("Piper missing: run python scripts/setup_models.py")
        self.voice = PiperVoice.load(str(VOICE_PATH), use_cuda=False)
        self._synthesize("Ready.")

    def _transcribe(self, audio: np.ndarray) -> str:
        segments, _ = self.whisper.transcribe(
            audio, language="en", beam_size=1, condition_on_previous_text=False,
            vad_filter=True, no_speech_threshold=0.6,
        )
        return " ".join(s.text.strip() for s in segments).strip()

    async def transcribe(self, audio: np.ndarray) -> str:
        return await asyncio.get_running_loop().run_in_executor(
            self.stt_pool, self._transcribe, audio
        )

    def _synthesize(self, text: str) -> bytes:
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            self.voice.synthesize_wav(text, wav)
        return output.getvalue()

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.get_running_loop().run_in_executor(
            self.tts_pool, self._synthesize, text
        )

    async def chat(self, messages: list[dict[str, str]]):
        async with self.client.stream(
            "POST", "/api/chat",
            json={
                "model": MODEL_NAME, "messages": messages, "think": False,
                "stream": True, "keep_alive": "30m",
                "options": {"num_ctx": 4096, "num_predict": 128, "temperature": 0.5},
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                event = json.loads(line)
                if event.get("error"):
                    raise RuntimeError(event["error"])
                if text := event.get("message", {}).get("content", ""):
                    yield text

    async def close(self):
        await self.client.aclose()
        self.stt_pool.shutdown(wait=False, cancel_futures=True)
        self.tts_pool.shutdown(wait=False, cancel_futures=True)

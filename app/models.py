"""Local inference only. Single-worker executors serialize non-cancellable native calls."""

import asyncio
import gc
import io
import json
import os
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import httpx
import numpy as np

from app.core import (
    LanguageError,
    RecognitionError,
    ensure_supported_text,
    has_mixed_scripts,
    speech_parts,
)
from app.gpu_runtime import configure_gpu_runtime

ROOT = Path(__file__).resolve().parents[1]
MODEL_NAME = os.getenv("OLLAMA_MODEL", "qwen3:4b-instruct-2507-q4_K_M")
OLLAMA_URL = "http://127.0.0.1:11434"
VOICE_PATH = ROOT / "models/kokoro/kokoro-v1.0.int8.onnx"
GPU_VOICE_PATH = ROOT / "models/kokoro/kokoro-v1.0.onnx"
VOICE_STYLES_PATH = ROOT / "models/kokoro/voices-v1.0.bin"
SPEAKER = "hm_omega"
WHISPER_PATH = ROOT / "models/whisper-medium"

LANGUAGE_RULES = {
    "en": "For this turn reply only in English.",
    "hi": "For this turn reply only in Hindi, using Devanagari.",
    "mixed": (
        "For this turn reply in Hindi-English mix. Write Hindi in Devanagari and English "
        "words in Latin script. Answer the user's actual question using both scripts."
    ),
}
LANGUAGE_CLASSIFIER = (
    'Classify the requested reply language from the utterance. Return JSON {"language":"en"} '
    'for English, {"language":"hi"} for Hindi, or {"language":"mixed"} for Hinglish. '
    "Match the utterance unless it explicitly asks for another reply language. "
    'Example: "My name is Mira" -> en; "मेरा नाम मीरा है" -> hi; '
    '"मेरा job interview कल है" -> mixed; "mera interview kal hai" -> mixed. '
    '"जवाब इंग्लिश में देना" or "जवाब इंगलिश में देना" -> en. '
    "English words transcribed in Hindi script still count as English: "
    '"जॉब इंटरव्यू", "मीटिंग", "सिंपल टिप", "प्लीस" indicate Hinglish.'
)


@dataclass
class Recognition:
    text: str
    language: str
    metrics: dict[str, float] = field(default_factory=dict)


class Models:
    def __init__(self):
        self.stt_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="stt")
        self.tts_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tts")
        self.ready = False
        self.error: str | None = None
        self.load_seconds = 0.0
        self.stt_device = "loading"
        self.stt_compute_type = ""
        self.stt_model = "medium"
        self.tts_device = "loading"
        self.warning = None
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
        import ctranslate2
        from faster_whisper import WhisperModel

        configure_gpu_runtime()
        requested = os.getenv("STT_DEVICE", "auto")
        if requested not in {"auto", "cuda", "cpu"}:
            raise ValueError("STT_DEVICE must be auto, cuda or cpu.")

        def load(device):
            self.stt_device = device
            self.stt_model = "medium" if device == "cuda" else "small"
            self.stt_compute_type = "int8_float16" if device == "cuda" else "int8"
            path = WHISPER_PATH if device == "cuda" else ROOT / "models/whisper-small"
            if not path.is_dir():
                raise FileNotFoundError("Whisper missing: run python scripts/setup_models.py")
            self.whisper = WhisperModel(
                str(path), device=device, compute_type=self.stt_compute_type,
                cpu_threads=6, local_files_only=True,
            )
            list(self.whisper.transcribe(np.zeros(1600, dtype=np.float32), language="en")[0])

        if requested != "cpu" and ctranslate2.get_cuda_device_count():
            try:
                load("cuda")
                return
            except Exception as exc:
                self.warning = f"GPU recognition unavailable ({exc}). Using slower CPU fallback."
                self.whisper = None
                gc.collect()
        else:
            self.warning = "Using small CPU recognition. The GPU latency target does not apply."
        load("cpu")

    def _load_tts(self):
        configure_gpu_runtime()
        import onnxruntime
        from kokoro_onnx import Kokoro

        if not VOICE_STYLES_PATH.is_file():
            raise FileNotFoundError("Kokoro missing: run python scripts/setup_models.py")
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = 6
        options.inter_op_num_threads = 1

        def load(device):
            path = GPU_VOICE_PATH if device == "cuda" else VOICE_PATH
            if not path.is_file():
                raise FileNotFoundError("Kokoro missing: run python scripts/setup_models.py")
            providers = ["CPUExecutionProvider"]
            if device == "cuda":
                providers.insert(0, ("CUDAExecutionProvider", {
                    "gpu_mem_limit": 1536 * 1024**2,
                    "cudnn_conv_algo_search": "HEURISTIC",
                    "cudnn_conv_use_max_workspace": "0",
                }))
            session = onnxruntime.InferenceSession(
                str(path), sess_options=options, providers=providers,
            )
            if device == "cuda" and "CUDAExecutionProvider" not in session.get_providers():
                raise RuntimeError("CUDA speech provider did not load")
            self.voice = Kokoro.from_session(session, str(VOICE_STYLES_PATH))
            self._synthesize("Ready.")
            self._synthesize("नमस्ते।")
            self.tts_device = device

        if "CUDAExecutionProvider" in onnxruntime.get_available_providers():
            try:
                load("cuda")
                return
            except Exception as exc:
                self.voice = None
                gc.collect()
                self.warning = " ".join(filter(None, [
                    self.warning, f"GPU speech unavailable ({exc}). Using slower CPU speech.",
                ]))
        else:
            self.warning = " ".join(filter(None, [
                self.warning,
                "Using slower CPU speech. Install the optional GPU runtime for CUDA speech.",
            ]))
        load("cpu")

    def _transcribe(self, audio: np.ndarray, input_language="auto", queued_at=None) -> Recognition:
        started = time.perf_counter()
        metrics = {"stt_queue_ms": (started - (queued_at or started)) * 1000}
        if input_language == "auto":
            _, _, scores = self.whisper.detect_language(audio=audio)
            candidates = sorted(
                ((language, score) for language, score in scores if language in {"en", "hi"}),
                key=lambda item: item[1], reverse=True,
            )
            languages = [language for language, _ in candidates]
        elif input_language in {"en", "hi"}:
            languages = [input_language]
        else:
            raise ValueError("Invalid input language.")
        metrics["language_detect_ms"] = (time.perf_counter() - started) * 1000
        decode_started = time.perf_counter()
        heard_segments = False
        uncertain = False
        for language in languages:
            segments, _ = self.whisper.transcribe(
                audio, language=language, task="transcribe",
                beam_size=3 if len(audio) <= 32000 else 1, temperature=0,
                condition_on_previous_text=False, vad_filter=True, no_speech_threshold=0.6,
            )
            segments = list(segments)
            if not segments:
                continue
            heard_segments = True
            # Whisper's built-in silence check can accept confident words over non-speech.
            if any(s.avg_logprob < -1.0 or s.no_speech_prob >= 0.6 for s in segments):
                uncertain = True
                continue
            text = " ".join(segment.text.strip() for segment in segments).strip()
            try:
                ensure_supported_text(text)
            except LanguageError:
                continue
            metrics["stt_decode_ms"] = (time.perf_counter() - decode_started) * 1000
            metrics["stt_avg_logprob"] = min(s.avg_logprob for s in segments)
            metrics["stt_no_speech_prob"] = max(s.no_speech_prob for s in segments)
            return Recognition(text, language, metrics)
        if not heard_segments and languages:
            return Recognition("", languages[0], metrics)
        if uncertain:
            raise RecognitionError(
                "I couldn't hear that clearly. Please repeat your interruption or choose "
                "English or Hindi/Hinglish above."
            )
        raise LanguageError(
            "I couldn't recognize that in English or Hindi. Select an input language and try again."
        )

    async def transcribe(self, audio: np.ndarray, input_language="auto") -> Recognition:
        return await asyncio.get_running_loop().run_in_executor(
            self.stt_pool, self._transcribe, audio, input_language, time.perf_counter()
        )

    def _synthesize(self, text: str) -> bytes:
        ensure_supported_text(text)
        # Change pronunciation by script, keeping one speaker and one continuous inference.
        phonemes = " ".join(
            self.voice.tokenizer.phonemize(
                part.replace("।", ".").replace("॥", "."), lang="hi" if hindi else "en-us",
            )
            for hindi, part in speech_parts(text)
        )
        if not phonemes.strip():
            raise ValueError("Nothing to synthesize.")
        audio, sample_rate = self.voice.create(phonemes, voice=SPEAKER, is_phonemes=True)
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            wav.setparams((1, 2, sample_rate, 0, "NONE", "not compressed"))
            wav.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
        return output.getvalue()

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.get_running_loop().run_in_executor(
            self.tts_pool, self._synthesize, text
        )

    async def chat(self, messages: list[dict[str, str]], metrics=None):
        metrics = metrics if metrics is not None else {}
        policy_started = time.perf_counter()
        latest = next(m["content"] for m in reversed(messages) if m["role"] == "user")
        selection = await self.client.post("/api/chat", json={
            "model": MODEL_NAME, "think": False, "stream": False, "keep_alive": "30m",
            "messages": [{"role": "user", "content": (
                LANGUAGE_CLASSIFIER + "\nUtterance: " + latest + "\nJSON:"
            )}],
            "format": {
                "type": "object", "properties": {
                    "language": {"type": "string", "enum": list(LANGUAGE_RULES)},
                }, "required": ["language"], "additionalProperties": False,
            },
            "options": {"num_ctx": 4096, "num_predict": 32, "temperature": 0},
        })
        selection.raise_for_status()
        metrics["reply_language_ms"] = (time.perf_counter() - policy_started) * 1000
        language = json.loads(selection.json()["message"]["content"])["language"]
        if language not in LANGUAGE_RULES:
            raise ValueError("The local model returned an unsupported reply language.")
        messages = [
            {"role": "system", "content": messages[0]["content"] + " " + LANGUAGE_RULES[language]},
            *messages[1:],
        ]
        held = ""
        release = language != "mixed"
        generation_started = time.perf_counter()
        async with self.client.stream(
            "POST", "/api/chat",
            json={
                "model": MODEL_NAME, "messages": messages, "think": False,
                "stream": True, "keep_alive": "30m",
                "options": {"num_ctx": 4096, "num_predict": 192, "temperature": 0.3},
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
                    metrics.setdefault(
                        "llm_first_token_ms", (time.perf_counter() - generation_started) * 1000,
                    )
                    ensure_supported_text(text)
                    if release:
                        yield text
                    else:
                        held += text
                        if has_mixed_scripts(held):
                            yield held
                            held = ""
                            release = True
        if held:
            repair_started = time.perf_counter()
            # Do not speak a Hindi-only draft when a mixed reply was selected.
            has_hindi = any(hindi for hindi, _ in speech_parts(held))
            missing = "English in Latin script" if has_hindi else "Hindi in Devanagari"
            repair = await self.client.post("/api/chat", json={
                "model": MODEL_NAME, "think": False, "stream": False, "keep_alive": "30m",
                "messages": [{"role": "system", "content": (
                    f"Add one short relevant sentence in {missing} to the supplied reply. "
                    "Add a helpful detail without repeating the reply. "
                    "Output only the added sentence, without explanation or markdown."
                )}, {"role": "user", "content": held}],
                "options": {"num_ctx": 4096, "num_predict": 192, "temperature": 0},
            })
            repair.raise_for_status()
            metrics["repair_ms"] = (time.perf_counter() - repair_started) * 1000
            rewritten = held.strip() + " " + repair.json()["message"]["content"].strip()
            ensure_supported_text(rewritten)
            if not has_mixed_scripts(rewritten):
                raise ValueError("The local model could not produce a Hinglish reply. Try again.")
            yield rewritten

    async def close(self):
        await self.client.aclose()
        self.stt_pool.shutdown(wait=False, cancel_futures=True)
        self.tts_pool.shutdown(wait=False, cancel_futures=True)

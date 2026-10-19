import io
import json
import wave
from types import SimpleNamespace

import httpx
import numpy as np
import pytest

from app.core import History, LanguageError, RecognitionError
from app.models import LANGUAGE_RULES, Models


def test_recognition_preserves_hindi_and_english_instead_of_translating():
    class Recognizer:
        def detect_language(self, **kwargs):
            return "ta", 0.6, [("ta", 0.6), ("hi", 0.3), ("en", 0.1)]

        def transcribe(self, audio, **options):
            assert options.get("language") == "hi"
            assert options.get("task") == "transcribe"
            return iter([SimpleNamespace(
                text=" मेरी meeting कल है। ", avg_logprob=-0.2, no_speech_prob=0.01,
            )]), None

    models = Models.__new__(Models)
    models.whisper = Recognizer()
    result = models._transcribe(np.ones(4000))
    assert result.text == "मेरी meeting कल है।"
    assert result.language == "hi"


def test_auto_retries_other_language_and_manual_mode_does_not_guess():
    class Recognizer:
        calls = []
        detection_calls = 0

        def detect_language(self, **kwargs):
            self.detection_calls += 1
            return "ta", 0.7, [("ta", 0.7), ("en", 0.2), ("hi", 0.1)]

        def transcribe(self, audio, **options):
            language = options["language"]
            self.calls.append(language)
            return iter([SimpleNamespace(
                text="வணக்கம்" if language == "en" else "नमस्ते",
                avg_logprob=-0.2, no_speech_prob=0.01,
            )]), None

    models = Models.__new__(Models)
    models.whisper = Recognizer()
    assert models._transcribe(np.ones(4000)).text == "नमस्ते"
    assert models.whisper.calls == ["en", "hi"]
    models.whisper.calls.clear()
    with pytest.raises(LanguageError):
        models._transcribe(np.ones(4000), "en")
    assert models.whisper.calls == ["en"]
    assert models.whisper.detection_calls == 1


@pytest.mark.parametrize("logprob,no_speech", [(-1.5, 0.05), (-0.2, 0.9)])
def test_uncertain_thank_you_is_never_accepted_as_an_interruption(logprob, no_speech):
    calls = []

    class Recognizer:
        def detect_language(self, **kwargs):
            return "en", 0.7, [("en", 0.7), ("hi", 0.3)]

        def transcribe(self, audio, **options):
            calls.append(options["language"])
            return iter([SimpleNamespace(
                text="Thank you.", avg_logprob=logprob, no_speech_prob=no_speech,
            )]), None

    models = Models.__new__(Models)
    models.whisper = Recognizer()
    with pytest.raises(RecognitionError, match="clearly"):
        models._transcribe(np.ones(8000))
    assert calls == ["en", "hi"]


def test_short_interruption_retries_language_but_genuine_thanks_remain_valid():
    class Recognizer:
        def detect_language(self, **kwargs):
            return "en", 0.7, [("en", 0.7), ("hi", 0.3)]

        def transcribe(self, audio, **options):
            assert options["temperature"] == 0
            assert options["beam_size"] == 3
            if options["language"] == "en":
                return iter([SimpleNamespace(
                    text="Thank you.", avg_logprob=-1.4, no_speech_prob=0.1,
                )]), None
            return iter([SimpleNamespace(text="रुको।", avg_logprob=-0.3, no_speech_prob=0.01)]), None

    models = Models.__new__(Models)
    models.whisper = Recognizer()
    result = models._transcribe(np.ones(8000))
    assert result.text == "रुको।"
    assert result.language == "hi"
    models.whisper.transcribe = lambda *args, **kwargs: (iter([SimpleNamespace(
        text="Thank you.", avg_logprob=-0.1, no_speech_prob=0.01,
    )]), None)
    assert models._transcribe(np.ones(8000), "en").text == "Thank you."


def test_gpu_failure_loads_explicit_small_cpu_fallback(monkeypatch):
    import ctranslate2
    import faster_whisper

    devices = []

    class Recognizer:
        def __init__(self, path, device, **kwargs):
            devices.append((path, device, kwargs["compute_type"]))
            self.device = device

        def transcribe(self, *args, **kwargs):
            if self.device == "cuda":
                raise RuntimeError("missing CUDA runtime")
            return iter([]), None

    monkeypatch.setenv("STT_DEVICE", "cuda")
    monkeypatch.setattr("app.models.configure_gpu_runtime", lambda: None)
    monkeypatch.setattr(ctranslate2, "get_cuda_device_count", lambda: 1)
    monkeypatch.setattr(faster_whisper, "WhisperModel", Recognizer)
    models = Models.__new__(Models)
    models._load_stt()
    assert [d[1] for d in devices] == ["cuda", "cpu"]
    assert devices[-1][0].endswith("whisper-small")
    assert models.stt_device == "cpu"
    assert models.stt_model == "small"
    assert "fallback" in models.warning


def test_speech_uses_one_speaker_for_every_language_and_one_inference_per_sentence():
    class Voice:
        def __init__(self):
            self.calls = []
            self.tokenizer = SimpleNamespace(phonemize=self.phonemize)

        def phonemize(self, text, lang):
            self.calls.append((text, lang))
            return text

        def create(self, text, **options):
            assert options == {"voice": "hm_omega", "is_phonemes": True}
            assert text
            return np.full(100, 0.5, dtype=np.float32), 24000

    models = Models.__new__(Models)
    models.voice = Voice()
    for text in ["Hello.", "नमस्ते।", "आपकी meeting कल है।", "Hello।"]:
        with wave.open(io.BytesIO(models._synthesize(text)), "rb") as audio:
            assert audio.getparams()[:3] == (1, 2, 24000)
            samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2")
            assert np.array_equal(samples, np.full(100, 16383))
    assert models.voice.calls == [
        ("Hello.", "en-us"), ("नमस्ते.", "hi"), ("आपकी", "hi"),
        ("meeting", "en-us"), ("कल है.", "hi"), ("Hello.", "en-us"),
    ]


def test_speech_rejects_unsupported_script_and_empty_phonemes_before_inference():
    models = Models.__new__(Models)
    with pytest.raises(LanguageError):
        models._synthesize("வணக்கம்")
    models.voice = SimpleNamespace(
        tokenizer=SimpleNamespace(phonemize=lambda *args, **kwargs: ""),
    )
    with pytest.raises(ValueError, match="Nothing to synthesize"):
        models._synthesize("Hello")


@pytest.mark.parametrize("failure", ["warmup", "provider", "unavailable", None])
def test_synthesis_warms_gpu_and_reports_cpu_fallback(monkeypatch, tmp_path, failure):
    import kokoro_onnx
    import onnxruntime

    for constant in ["VOICE_PATH", "GPU_VOICE_PATH", "VOICE_STYLES_PATH"]:
        path = tmp_path / constant
        path.touch()
        monkeypatch.setattr(f"app.models.{constant}", path)
    monkeypatch.setattr("app.models.configure_gpu_runtime", lambda: None)
    monkeypatch.setattr(onnxruntime, "get_available_providers", lambda: (
        [] if failure == "unavailable" else ["CUDAExecutionProvider"]
    ))
    calls = []

    def session(path, sess_options, providers):
        gpu = isinstance(providers[0], tuple)
        calls.append((path, gpu))
        active = ["CUDAExecutionProvider"] if gpu and failure != "provider" else []
        return SimpleNamespace(gpu=gpu, get_providers=lambda: [*active, "CPUExecutionProvider"])

    monkeypatch.setattr(onnxruntime, "InferenceSession", session)
    monkeypatch.setattr(kokoro_onnx.Kokoro, "from_session", lambda session, _: session)
    models = Models.__new__(Models)
    models.warning = "Existing recognition warning."

    def synthesize(text):
        if models.voice.gpu and failure == "warmup":
            raise RuntimeError("GPU warmup failed")

    models._synthesize = synthesize
    models._load_tts()
    if failure != "unavailable":
        assert calls[0] == (str(tmp_path / "GPU_VOICE_PATH"), True)
    assert models.tts_device == ("cpu" if failure else "cuda")
    assert "Existing recognition warning." in models.warning
    if failure:
        assert calls[-1] == (str(tmp_path / "VOICE_PATH"), False)
        assert "slower CPU speech" in models.warning
    else:
        assert len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("language", ["en", "hi", "mixed", "invalid"])
async def test_each_turn_applies_validated_language_policy_without_changing_history(language):
    history = History()
    history.begin(1, "नमस्ते")
    history.begin(2, "Please answer in English.")
    messages = history.messages()
    requests = []

    def respond(request):
        body = json.loads(request.content)
        requests.append(body)
        if "format" in body:
            assert "Please answer in English." in body["messages"][0]["content"]
            return httpx.Response(200, json={
                "message": {"content": json.dumps({"language": language})},
            })
        assert body["messages"][0]["content"].endswith(LANGUAGE_RULES[language])
        reply = "यह एक reply है।" if language == "mixed" else "A reply."
        return httpx.Response(200, text=json.dumps({"message": {"content": reply}}) + "\n")

    models = Models.__new__(Models)
    async with httpx.AsyncClient(
        base_url="http://127.0.0.1:11434", transport=httpx.MockTransport(respond),
    ) as client:
        models.client = client
        if language == "invalid":
            with pytest.raises(ValueError, match="unsupported reply language"):
                _ = [part async for part in models.chat(messages)]
            assert len(requests) == 1
        else:
            expected = "यह एक reply है।" if language == "mixed" else "A reply."
            assert [part async for part in models.chat(messages)] == [expected]
            assert len(requests) == 2
    assert messages == history.messages()


@pytest.mark.asyncio
@pytest.mark.parametrize("repair_text", ["थोड़ी practice करें।", "अभ्यास करें।"])
async def test_hinglish_reply_is_repaired_before_wrong_language_reaches_playback(repair_text):
    def respond(request):
        body = json.loads(request.content)
        if "format" in body:
            return httpx.Response(200, json={"message": {"content": '{"language":"mixed"}'}})
        if body["stream"]:
            return httpx.Response(200, text=json.dumps({
                "message": {"content": "अभ्यास करें।"},
            }) + "\n")
        return httpx.Response(200, json={"message": {"content": repair_text}})

    history = History()
    history.begin(1, "मेरा interview है, कोई tip दो।")
    models = Models.__new__(Models)
    async with httpx.AsyncClient(
        base_url="http://127.0.0.1:11434", transport=httpx.MockTransport(respond),
    ) as client:
        models.client = client
        if "practice" in repair_text:
            assert [part async for part in models.chat(history.messages())] == [
                "अभ्यास करें। " + repair_text,
            ]
        else:
            with pytest.raises(ValueError, match="could not produce a Hinglish reply"):
                _ = [part async for part in models.chat(history.messages())]

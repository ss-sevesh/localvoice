import asyncio

import numpy as np
import pytest

from app.conversation import Conversation


class FakeModels:
    ready = True

    async def transcribe(self, audio):
        return "My name is Mira"

    async def chat(self, messages):
        self.messages = messages
        yield "Hello Mira. "
        yield "Nice to meet you."

    async def synthesize(self, text):
        return b"wave"


@pytest.mark.asyncio
async def test_streams_text_and_ordered_audio_then_commits_only_played_chunks():
    events = []

    async def send(event):
        events.append(event)

    session = Conversation(FakeModels(), send)
    await session.start(1, np.ones(4000, dtype=np.float32))
    await session.task
    audio = [e for e in events if e["type"] == "audio"]
    assert [e["index"] for e in audio] == [0, 1]
    assert any(e["type"] == "text_delta" for e in events)
    assert "assistant" not in [m["role"] for m in session.history.messages()[1:]]
    session.ack(1, 0)
    assert session.history.messages()[-1]["content"] == "Hello Mira."
    await session.cancel()
    session.ack(1, 1)
    assert session.history.messages()[-1]["content"] == "Hello Mira."


@pytest.mark.asyncio
async def test_cancellation_during_native_work_never_emits_old_result():
    gate = asyncio.Event()

    class SlowModels(FakeModels):
        async def transcribe(self, audio):
            await gate.wait()
            return "late transcript"

    events = []

    async def send(event):
        events.append(event)

    session = Conversation(SlowModels(), send)
    await session.start(1, np.ones(4000))
    await asyncio.sleep(0)
    await session.cancel()
    gate.set()
    await asyncio.sleep(0)
    assert not any(e["type"] in ("transcript", "audio") for e in events)


@pytest.mark.asyncio
async def test_audio_backpressure_waits_for_playback_ack():
    class ManySentences(FakeModels):
        async def chat(self, messages):
            yield "One. Two. Three. Four."

    events = []

    async def send(event):
        events.append(event)

    session = Conversation(ManySentences(), send)
    await session.start(1, np.ones(4000))
    for _ in range(20):
        await asyncio.sleep(0)
    assert len([e for e in events if e["type"] == "audio"]) == 2
    session.ack(1, 0)
    session.ack(1, 1)
    await asyncio.wait_for(session.task, timeout=1)
    assert len([e for e in events if e["type"] == "audio"]) == 4


@pytest.mark.asyncio
async def test_model_failure_is_a_recoverable_error():
    class BrokenModels(FakeModels):
        async def transcribe(self, audio):
            raise RuntimeError("model unavailable")

    events = []

    async def send(event):
        events.append(event)

    session = Conversation(BrokenModels(), send)
    await session.start(1, np.ones(4000))
    await session.task
    assert events[-1]["type"] == "error"
    assert events[-1]["message"] == "model unavailable"


@pytest.mark.asyncio
async def test_synthesis_failure_does_not_deadlock_the_text_producer():
    class BrokenSpeech(FakeModels):
        async def chat(self, messages):
            for _ in range(20):
                yield "A sentence. "

        async def synthesize(self, text):
            raise RuntimeError("Synthesis failed")

    events = []

    async def send(event):
        events.append(event)

    session = Conversation(BrokenSpeech(), send)
    await session.start(1, np.ones(4000))
    await asyncio.wait_for(session.task, timeout=1)
    assert events[-1]["type"] == "error"


@pytest.mark.asyncio
async def test_cancel_closes_stream_even_when_waiting_for_audio_backpressure():
    class EndlessText(FakeModels):
        closed = False

        async def chat(self, messages):
            try:
                for _ in range(100):
                    yield "A sentence. "
            finally:
                self.closed = True

    models = EndlessText()

    async def send(event):
        pass

    session = Conversation(models, send)
    await session.start(1, np.ones(4000))
    for _ in range(50):
        await asyncio.sleep(0)
    await session.cancel()
    assert models.closed

"""One connection, one active turn, bounded synthesis and acknowledged memory."""

import asyncio
import base64
import logging
import time
from collections.abc import Awaitable, Callable
from contextlib import suppress

import numpy as np

from app.core import (
    History,
    LanguageError,
    RecognitionError,
    ensure_supported_text,
    split_sentences,
)
from app.models import Models

logger = logging.getLogger(__name__)


class Conversation:
    def __init__(self, models: Models, send: Callable[[dict], Awaitable[None]]):
        self.models = models
        self.send = send
        self.history = History()
        self.turn_id = -1
        self.task: asyncio.Task | None = None
        self.window = asyncio.Semaphore(2)

    async def cancel(self):
        self.turn_id = -1
        self.history.turn_id = -1
        if self.task:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task
            self.task = None

    async def start(self, turn_id: int, audio: np.ndarray, input_language="auto"):
        await self.cancel()
        self.turn_id = turn_id
        self.window = asyncio.Semaphore(2)
        self.task = asyncio.create_task(self._run(turn_id, audio, input_language))

    def ack(self, turn_id: int, index: int):
        previous = self.history.acknowledged
        self.history.ack(turn_id, index)
        if self.history.acknowledged > previous:
            self.window.release()

    async def _emit(self, turn_id: int, event_type: str, **payload):
        if turn_id == self.turn_id:
            await self.send({"type": event_type, "turn_id": turn_id, **payload})

    async def _run(self, turn_id: int, audio: np.ndarray, input_language):
        started = time.perf_counter()
        metrics = {}
        consumer = None

        def elapsed():
            return round((time.perf_counter() - started) * 1000, 1)

        try:
            await self._emit(turn_id, "state", state="transcribing")
            recognition = await self.models.transcribe(audio, input_language)
            transcript = ensure_supported_text(recognition.text)
            metrics.update(recognition.metrics)
            metrics["stt_ms"] = elapsed()
            if not transcript:
                await self._emit(turn_id, "empty")
                return
            self.history.begin(turn_id, transcript)
            await self._emit(turn_id, "transcript", text=transcript, language=recognition.language)
            await self._emit(turn_id, "state", state="generating")
            queue: asyncio.Queue[str | None] = asyncio.Queue(maxsize=2)

            async def speak():
                index = 0
                tts_ms = 0.0
                while (sentence := await queue.get()) is not None:
                    await self.window.acquire()
                    synth_started = time.perf_counter()
                    wav = await self.models.synthesize(sentence)
                    tts_ms += (time.perf_counter() - synth_started) * 1000
                    self.history.sent(turn_id, index, sentence)
                    await self._emit(
                        turn_id, "audio", index=index, text=sentence,
                        wav=base64.b64encode(wav).decode(),
                    )
                    if index == 0:
                        metrics["tts_first_chunk_ms"] = (time.perf_counter() - synth_started) * 1000
                        metrics["first_audio_ready_ms"] = elapsed()
                    index += 1
                metrics["tts_ms"] = round(tts_ms, 1)

            consumer = asyncio.create_task(speak())
            pending = ""
            async for delta in self.models.chat(self.history.messages(), metrics=metrics):
                ensure_supported_text(delta)
                metrics.setdefault("first_text_ms", elapsed())
                await self._emit(turn_id, "text_delta", text=delta)
                sentences, pending = split_sentences(pending + delta)
                for sentence in sentences:
                    await self._put(queue, sentence, consumer)
            sentences, _ = split_sentences(pending, final=True)
            for sentence in sentences:
                await self._put(queue, sentence, consumer)
            await self._put(queue, None, consumer)
            await consumer
            metrics["server_total_ms"] = elapsed()
            await self._emit(turn_id, "turn_done", metrics=metrics)
        except asyncio.CancelledError:
            raise
        except (LanguageError, RecognitionError) as exc:
            await self._emit(
                turn_id, "error", message=str(exc), recoverable=True,
                code=("unclear_speech" if isinstance(exc, RecognitionError)
                      else "unsupported_language"),
            )
        except Exception as exc:
            logger.exception("Turn %s failed", turn_id)
            await self._emit(turn_id, "error", message=str(exc))
        finally:
            if consumer:
                consumer.cancel()
                with suppress(asyncio.CancelledError, Exception):
                    await consumer

    @staticmethod
    async def _put(queue, item, consumer):
        # A failed synthesizer must not strand the producer on a full queue.
        put = asyncio.create_task(queue.put(item))
        try:
            await asyncio.wait({put, consumer}, return_when=asyncio.FIRST_COMPLETED)
            if consumer.done():
                await consumer
            await put
        finally:
            put.cancel()
            with suppress(asyncio.CancelledError):
                await put

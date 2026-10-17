import base64

import numpy as np
import pytest

from app.core import History, decode_audio, split_sentences


def test_audio_rejects_invalid_oversized_and_silent_inputs():
    for value in ("not base64!", base64.b64encode(b"x").decode()):
        with pytest.raises(ValueError):
            decode_audio(value)
    with pytest.raises(ValueError, match="30 seconds"):
        decode_audio(base64.b64encode(bytes(16000 * 2 * 31)).decode())
    assert decode_audio(base64.b64encode(bytes(3200)).decode()) is None


def test_audio_decodes_little_endian_pcm():
    samples = np.full(4000, 12000, dtype="<i2")
    decoded = decode_audio(base64.b64encode(samples.tobytes()).decode())
    assert decoded.dtype == np.float32
    assert decoded[0] == pytest.approx(12000 / 32768)


def test_sentences_keep_incomplete_text_until_finish():
    ready, pending = split_sentences("Hello there. How are")
    assert ready == ["Hello there."]
    assert pending == "How are"
    assert split_sentences(pending, final=True) == (["How are"], "")


def test_history_only_keeps_audio_acknowledged_in_order():
    history = History()
    history.begin(1, "My name is Mira")
    history.sent(1, 0, "Hello Mira.")
    history.sent(1, 1, "How can I help?")
    history.ack(1, 1)  # A client cannot skip ahead.
    assert len(history.messages()) == 2
    history.ack(1, 0)
    history.begin(2, "What is my name?")
    history.ack(1, 1)  # Late ack must not leak into the new turn.
    messages = history.messages()
    assert messages[-2] == {"role": "assistant", "content": "Hello Mira."}
    assert messages[-1]["content"] == "What is my name?"


def test_history_is_bounded_and_resettable():
    history = History()
    for turn in range(12):
        history.begin(turn, "question " * 500)
        history.sent(turn, 0, "answer")
        history.ack(turn, 0)
    assert len(history.messages()) <= 13
    assert sum(len(m["content"]) for m in history.messages()) < 9000
    history.clear()
    assert len(history.messages()) == 1

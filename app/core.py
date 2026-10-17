"""Audio validation, sentence boundaries, and bounded spoken conversation memory."""

import base64
import binascii
import re

import numpy as np

SYSTEM = (
    "You are Local Voice, a friendly conversational assistant. Reply in English using "
    "one or two short sentences, usually under 45 words. Use plain spoken text without "
    "markdown, lists, or emojis. Remember details in this conversation. Be honest when "
    "unsure. You have no live internet or tools."
)


def decode_audio(encoded: str) -> np.ndarray | None:
    if len(encoded) > 1_280_000:
        raise ValueError("Audio must be at most 30 seconds.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Audio must be valid base64 PCM.") from exc
    if not raw or len(raw) % 2:
        raise ValueError("Audio must contain little-endian 16-bit PCM samples.")
    if len(raw) > 960_000:
        raise ValueError("Audio must be at most 30 seconds.")
    samples = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
    if len(samples) < 1600 or float(np.sqrt(np.mean(samples**2))) < 0.002:
        return None
    return samples


def split_sentences(text: str, final: bool = False) -> tuple[list[str], str]:
    sentences = []
    while match := re.search(r"[.!?](?:[\"']?)(?:\s+|$)", text):
        end = match.end()
        sentences.append(text[:end].strip())
        text = text[end:]
    # Bound synthesis latency even when the model produces no punctuation.
    while len(text) > 240:
        end = text.rfind(" ", 0, 240)
        end = end if end > 0 else 240
        sentences.append(text[:end].strip())
        text = text[end:].lstrip()
    if final and text.strip():
        sentences.append(text.strip())
        text = ""
    return sentences, text


class History:
    def __init__(self):
        self.clear()

    def clear(self):
        self.turns: list[dict] = []
        self.turn_id = -1
        self.chunks: list[str] = []
        self.acknowledged = 0

    def begin(self, turn_id: int, text: str):
        self.turn_id = turn_id
        self.chunks = []
        self.acknowledged = 0
        self.turns.append({"user": text[:4000], "assistant": ""})
        self.turns = self.turns[-6:]
        while len(self.turns) > 1 and sum(
            len(t["user"]) + len(t["assistant"]) for t in self.turns
        ) > 8000:
            self.turns.pop(0)

    def sent(self, turn_id: int, index: int, text: str):
        if turn_id == self.turn_id and index == len(self.chunks):
            self.chunks.append(text)

    def ack(self, turn_id: int, index: int):
        if (
            turn_id == self.turn_id
            and index == self.acknowledged
            and index < len(self.chunks)
        ):
            self.acknowledged += 1
            self.turns[-1]["assistant"] = " ".join(self.chunks[: self.acknowledged])

    def messages(self) -> list[dict[str, str]]:
        result = [{"role": "system", "content": SYSTEM}]
        for turn in self.turns:
            result.append({"role": "user", "content": turn["user"]})
            if turn["assistant"]:
                result.append({"role": "assistant", "content": turn["assistant"]})
        return result

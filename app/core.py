"""Audio validation, sentence boundaries, and bounded spoken conversation memory."""

import base64
import binascii
import re
import unicodedata

import numpy as np

SYSTEM = (
    "You are Local Voice, a friendly conversational assistant. "
    "Match the language of the user's latest utterance, including any mix of languages, "
    "even when it changes from earlier turns. Follow explicit requests for a reply language. "
    "Use native scripts, not romanized transliterations. "
    "Reply using one or two short sentences, usually under 45 words. Use plain spoken text without "
    "markdown, lists, or emojis. Remember details in this conversation. Be honest when "
    "unsure. You have no live internet or tools."
)


class LanguageError(ValueError):
    """A recoverable recognition/language failure, never raw text to display."""


class RecognitionError(ValueError):
    """Audio was too uncertain to accept as user speech."""


def ensure_supported_text(text: str) -> str:
    for char in text:
        if unicodedata.category(char)[0] not in {"L", "M"}:
            continue
        if ("\u0900" <= char <= "\u097f" or "\u0300" <= char <= "\u036f"
                or unicodedata.name(char, "").startswith("LATIN")):
            continue
        raise LanguageError(
            "I couldn't recognize that in English or Hindi. "
            "Choose English or Hindi/Hinglish above and try again."
        )
    return text


def speech_parts(text: str) -> list[tuple[bool, str]]:
    """Keep English phrases together; use Hindi synthesis for Devanagari spans."""
    parts = re.split(r"([A-Za-z]+(?:[A-Za-z0-9'’ ,:\-]*[A-Za-z0-9])?)", text)
    result = []
    for part in parts:
        if part.strip() and any(c.isalnum() for c in part):
            hindi = any("\u0900" <= c <= "\u097f" and c.isalpha() for c in part)
            result.append((hindi, part.strip()))
        elif result:
            hindi, previous = result[-1]
            result[-1] = (hindi, previous + part)
    return result


def has_mixed_scripts(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]{2,}", text)) and any(
        "\u0900" <= char <= "\u097f" and char.isalpha() for char in text
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
    while match := re.search(r"(?:[.!?][\"']?(?:\s+|$)|[।॥]\s*)", text):
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
    return [s for s in sentences if any(c.isalnum() for c in s)], text


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

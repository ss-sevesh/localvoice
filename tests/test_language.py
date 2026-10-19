import pytest

from app.core import LanguageError, ensure_supported_text


@pytest.mark.parametrize("text", ["Hello, café!", "नमस्ते।", "मेरी meeting है।", "123 — 😊"])
def test_supported_text_preserves_original_characters(text):
    assert ensure_supported_text(text) == text


@pytest.mark.parametrize("text", ["வணக்கம்", "Hello வணக்கம்", "你好", "\u0bbe"])
def test_unsupported_scripts_are_rejected_including_combining_marks(text):
    with pytest.raises(LanguageError):
        ensure_supported_text(text)

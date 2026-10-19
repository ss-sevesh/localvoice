from contextlib import contextmanager
from types import SimpleNamespace

import pytest

from scripts import setup_models


def test_kokoro_download_rejects_changed_weights_without_replacing_model(tmp_path, monkeypatch):
    directory = tmp_path / "kokoro"
    directory.mkdir()
    target = directory / "kokoro-v1.0.onnx"
    target.write_bytes(b"existing file")
    monkeypatch.setattr(setup_models, "MODELS", tmp_path)

    @contextmanager
    def download(*args, **kwargs):
        yield SimpleNamespace(
            raise_for_status=lambda: None,
            iter_bytes=lambda: iter([b"unexpected upstream weights"]),
        )

    monkeypatch.setattr(setup_models.httpx, "stream", download)
    with pytest.raises(ValueError, match="checksum mismatch"):
        setup_models.setup_kokoro()
    assert target.read_bytes() == b"existing file"

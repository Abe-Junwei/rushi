from __future__ import annotations

import pytest

from rushi_asr.app import bind_addr


def test_bind_rejects_non_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASR_HOST", "0.0.0.0")
    with pytest.raises(RuntimeError, match="loopback"):
        bind_addr()

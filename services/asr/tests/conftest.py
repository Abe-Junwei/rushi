"""Shared pytest fixtures for rushi_asr tests."""

from __future__ import annotations

import pytest

# Developer shell model overrides must not affect default-SKU test expectations.
_ASR_ENV_KEYS = ("RUSHI_FUNASR_MODEL",)


@pytest.fixture(autouse=True)
def _clear_asr_model_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Developer shell exports must not change default-SKU test expectations."""
    for key in _ASR_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)

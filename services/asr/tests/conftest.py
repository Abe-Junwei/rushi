"""Shared pytest fixtures for rushi_asr tests."""

from __future__ import annotations

import pytest

# Env vars commonly set during R3g-B / Align spike hand-tests; must not affect unit tests.
_SPIKE_ENV_KEYS = (
    "RUSHI_FUNASR_MODEL",
    "RUSHI_FUNASR_FORCED_ALIGNER",
)


@pytest.fixture(autouse=True)
def _clear_spike_asr_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Developer shell spike exports must not change default-SKU test expectations."""
    for key in _SPIKE_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)

from __future__ import annotations

from rushi_asr.transcribe_timeouts import (
    MAX_PIPELINE_TIMEOUT_SEC,
    MIN_PIPELINE_TIMEOUT_SEC,
    pipeline_timeout_sec,
)


def test_pipeline_timeout_clamps_to_minimum() -> None:
    assert pipeline_timeout_sec(None) == MIN_PIPELINE_TIMEOUT_SEC
    assert pipeline_timeout_sec(60) == MIN_PIPELINE_TIMEOUT_SEC


def test_pipeline_timeout_scales_with_duration() -> None:
    # 50 min → 4 * 3000 + 300 = 12300 → capped
    assert pipeline_timeout_sec(50 * 60) == MAX_PIPELINE_TIMEOUT_SEC
    assert pipeline_timeout_sec(10 * 60) == 4 * 600 + 300


def test_pipeline_timeout_respects_max() -> None:
    assert pipeline_timeout_sec(10_000) == MAX_PIPELINE_TIMEOUT_SEC

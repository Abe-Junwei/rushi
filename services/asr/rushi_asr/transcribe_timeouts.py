"""Shared timeout budget for ffmpeg normalize + FunASR whole-file inference (R3e-A)."""

from __future__ import annotations

import math

MIN_PIPELINE_TIMEOUT_SEC = 600
MAX_PIPELINE_TIMEOUT_SEC = 7200
_PER_DURATION_FACTOR = 4.0
_FIXED_PADDING_SEC = 300


def pipeline_timeout_sec(duration_sec: float | None) -> int:
    """Derive blocking timeout from audio duration (lower/upper bound per R3e-A)."""
    if duration_sec is None or duration_sec <= 0 or not math.isfinite(duration_sec):
        return MIN_PIPELINE_TIMEOUT_SEC
    estimate = int(math.ceil(duration_sec * _PER_DURATION_FACTOR)) + _FIXED_PADDING_SEC
    return max(MIN_PIPELINE_TIMEOUT_SEC, min(MAX_PIPELINE_TIMEOUT_SEC, estimate))

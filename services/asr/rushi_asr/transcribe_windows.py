"""R3e-B: long-audio windowed FunASR transcribe (sidecar internal loop)."""

from __future__ import annotations

import logging
import os
import shutil
from collections.abc import Callable
from pathlib import Path

from rushi_asr import ffmpeg_audio
from rushi_asr.schemas import TranscriptionSegment

log = logging.getLogger(__name__)

DEFAULT_WINDOW_SEC = 300.0
DEFAULT_ASYNC_WINDOW_SEC = 120.0
DEFAULT_WINDOW_THRESHOLD_SEC = 1800.0
DEFAULT_WINDOW_OVERLAP_SEC = 2.0


class TranscribeCancelledError(Exception):
    """Cooperative cancel between windows (R3e-C)."""


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def window_overlap_sec() -> float:
    raw = os.environ.get("RUSHI_FUNASR_WINDOW_OVERLAP_SEC", "").strip()
    if not raw:
        return DEFAULT_WINDOW_OVERLAP_SEC
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_WINDOW_OVERLAP_SEC
    return max(0.0, value)


def effective_window_overlap_sec(slice_sec: float, overlap_sec: float | None = None) -> float:
    overlap = window_overlap_sec() if overlap_sec is None else max(0.0, overlap_sec)
    return min(overlap, max(0.0, slice_sec - 0.5))


def window_sec() -> float:
    return _env_float("RUSHI_FUNASR_WINDOW_SEC", DEFAULT_WINDOW_SEC)


def async_window_sec() -> float:
    """R3e-C async preview slice size (blocking long-audio path keeps ``window_sec()``)."""
    return _env_float("RUSHI_FUNASR_ASYNC_WINDOW_SEC", DEFAULT_ASYNC_WINDOW_SEC)


def window_threshold_sec() -> float:
    return _env_float("RUSHI_FUNASR_WINDOW_THRESHOLD_SEC", DEFAULT_WINDOW_THRESHOLD_SEC)


def should_transcribe_by_windows(duration_sec: float | None) -> bool:
    if duration_sec is None or duration_sec <= 0:
        return False
    return duration_sec >= window_threshold_sec()


def async_window_threshold_sec() -> float:
    """R3e-C async preview: window earlier than blocking ``should_transcribe_by_windows``."""
    return _env_float("RUSHI_FUNASR_ASYNC_WINDOW_THRESHOLD_SEC", async_window_sec())


def should_transcribe_by_windows_async(duration_sec: float | None) -> bool:
    if duration_sec is None or duration_sec <= 0:
        return False
    return duration_sec >= async_window_threshold_sec()


def plan_windows(
    total_sec: float,
    slice_sec: float,
    *,
    overlap_sec: float | None = None,
) -> list[tuple[float, float]]:
    """Return ``(start_offset_sec, slice_duration_sec)`` for each window."""
    if total_sec <= 0 or slice_sec <= 0:
        return []
    overlap = effective_window_overlap_sec(slice_sec, overlap_sec)
    step = slice_sec - overlap if overlap > 0 else slice_sec
    if step <= 0:
        return [(0.0, total_sec)]
    windows: list[tuple[float, float]] = []
    start = 0.0
    while start < total_sec - 1e-6:
        dur = min(slice_sec, total_sec - start)
        windows.append((start, dur))
        if start + dur >= total_sec - 1e-6:
            break
        start += step
    return windows


def offset_segments(
    segments: list[TranscriptionSegment],
    offset_sec: float,
) -> list[TranscriptionSegment]:
    if offset_sec == 0:
        return list(segments)
    out: list[TranscriptionSegment] = []
    for seg in segments:
        out.append(
            TranscriptionSegment(
                start_sec=seg.start_sec + offset_sec,
                end_sec=seg.end_sec + offset_sec,
                text=seg.text,
                confidence=seg.confidence,
                low_confidence=seg.low_confidence,
                detail=seg.detail,
                kind=seg.kind,
            ),
        )
    return out


def sort_window_segments(segments: list[TranscriptionSegment]) -> list[TranscriptionSegment]:
    """Sort window slices by time; adjacent overlap trim is done in the Rust desktop layer."""
    return sorted(segments, key=lambda s: (s.start_sec, s.end_sec))


def trim_window_prefix_overlap(
    segments: list[TranscriptionSegment],
    cutoff_sec: float,
) -> list[TranscriptionSegment]:
    """Drop/trim the overlapped prefix from a later window before preview/final merge."""
    out: list[TranscriptionSegment] = []
    for seg in segments:
        if seg.end_sec <= cutoff_sec + 1e-6:
            continue
        start = max(seg.start_sec, cutoff_sec)
        if seg.end_sec <= start + 1e-6:
            continue
        out.append(
            TranscriptionSegment(
                start_sec=start,
                end_sec=seg.end_sec,
                text=seg.text,
                confidence=seg.confidence,
                low_confidence=seg.low_confidence,
                detail=seg.detail,
                kind=seg.kind,
            ),
        )
    return out


def transcribe_by_windows(
    wav_path: Path,
    total_duration_sec: float,
    *,
    hotwords: str | None = None,
    out_warnings: list[str] | None = None,
    on_window_done: Callable[[int, int, list[TranscriptionSegment]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
    slice_sec: float | None = None,
) -> tuple[list[TranscriptionSegment], str, str | None]:
    """Slice normalized WAV, run FunASR per window, merge with global timestamps."""
    from rushi_asr.funasr_engine import generate_and_parse_funasr

    def _warn(msg: str) -> None:
        if out_warnings is not None:
            out_warnings.append(msg)

    effective_slice_sec = slice_sec if slice_sec is not None else window_sec()
    effective_overlap_sec = effective_window_overlap_sec(effective_slice_sec)
    windows = plan_windows(total_duration_sec, effective_slice_sec)
    if not windows:
        raise RuntimeError("transcribe_window_plan_empty")

    _warn(f"transcribe_windowed:windows={len(windows)}")
    slice_dir = wav_path.parent / ".rushi_transcribe_windows"
    slice_dir.mkdir(parents=True, exist_ok=True)

    merged: list[TranscriptionSegment] = []
    engine_label = ""

    try:
        for index, (start_sec, dur_sec) in enumerate(windows, start=1):
            if should_cancel and should_cancel():
                raise TranscribeCancelledError()
            log.info(
                "transcribe_window i=%d n=%d start_sec=%.3f dur_sec=%.3f",
                index,
                len(windows),
                start_sec,
                dur_sec,
            )
            slice_path = slice_dir / f"win_{index:04d}.wav"
            ffmpeg_audio.extract_wav_segment(
                wav_path,
                slice_path,
                start_sec,
                dur_sec,
            )
            segs, engine_label, _mode = generate_and_parse_funasr(
                slice_path,
                dur_sec,
                hotwords,
                out_warnings,
            )
            offset = offset_segments(segs, start_sec)
            if index > 1 and effective_overlap_sec > 0:
                offset = trim_window_prefix_overlap(offset, start_sec + effective_overlap_sec)
            merged.extend(offset)
            if on_window_done is not None:
                on_window_done(index, len(windows), offset)
    finally:
        shutil.rmtree(slice_dir, ignore_errors=True)

    return sort_window_segments(merged), engine_label, "transcribe_windowed"

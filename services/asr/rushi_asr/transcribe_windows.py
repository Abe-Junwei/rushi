"""R3e-B: long-audio windowed FunASR transcribe (sidecar internal loop)."""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path

from rushi_asr import ffmpeg_audio
from rushi_asr.schemas import TranscriptionSegment

log = logging.getLogger(__name__)

DEFAULT_WINDOW_SEC = 300.0
DEFAULT_WINDOW_THRESHOLD_SEC = 1800.0


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def window_sec() -> float:
    return _env_float("RUSHI_FUNASR_WINDOW_SEC", DEFAULT_WINDOW_SEC)


def window_threshold_sec() -> float:
    return _env_float("RUSHI_FUNASR_WINDOW_THRESHOLD_SEC", DEFAULT_WINDOW_THRESHOLD_SEC)


def should_transcribe_by_windows(duration_sec: float | None) -> bool:
    if duration_sec is None or duration_sec <= 0:
        return False
    return duration_sec >= window_threshold_sec()


def plan_windows(total_sec: float, slice_sec: float) -> list[tuple[float, float]]:
    """Return ``(start_offset_sec, slice_duration_sec)`` for each window."""
    if total_sec <= 0 or slice_sec <= 0:
        return []
    windows: list[tuple[float, float]] = []
    start = 0.0
    while start < total_sec - 1e-6:
        dur = min(slice_sec, total_sec - start)
        windows.append((start, dur))
        start += slice_sec
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


def merge_window_segments(segments: list[TranscriptionSegment]) -> list[TranscriptionSegment]:
    return sorted(segments, key=lambda s: (s.start_sec, s.end_sec))


def transcribe_by_windows(
    wav_path: Path,
    total_duration_sec: float,
    *,
    hotwords: str | None = None,
    out_warnings: list[str] | None = None,
) -> tuple[list[TranscriptionSegment], str, str | None]:
    """Slice normalized WAV, run FunASR per window, merge with global timestamps."""
    from rushi_asr.funasr_engine import generate_and_parse_funasr

    def _warn(msg: str) -> None:
        if out_warnings is not None:
            out_warnings.append(msg)

    slice_sec = window_sec()
    windows = plan_windows(total_duration_sec, slice_sec)
    if not windows:
        raise RuntimeError("transcribe_window_plan_empty")

    _warn(f"transcribe_windowed:windows={len(windows)}")
    slice_dir = wav_path.parent / ".rushi_transcribe_windows"
    slice_dir.mkdir(parents=True, exist_ok=True)

    merged: list[TranscriptionSegment] = []
    engine_label = ""

    try:
        for index, (start_sec, dur_sec) in enumerate(windows, start=1):
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
            merged.extend(offset_segments(segs, start_sec))
    finally:
        shutil.rmtree(slice_dir, ignore_errors=True)

    return merge_window_segments(merged), engine_label, "transcribe_windowed"

"""Orchestrate FFmpeg normalization + stub or FunASR transcription."""

from __future__ import annotations

import logging
from pathlib import Path

from rushi_asr import ffmpeg_audio
from rushi_asr.schemas import TranscriptionError, TranscriptionResult, TranscriptionSegment

log = logging.getLogger(__name__)


def _stub_segments(duration_sec: float | None) -> tuple[list[TranscriptionSegment], str]:
    end = duration_sec if duration_sec is not None and duration_sec > 0 else 0.01
    seg = TranscriptionSegment(
        start_sec=0.0,
        end_sec=float(end),
        text="",
        confidence=None,
        low_confidence=False,
        detail="stub: set RUSHI_FUNASR_MODEL and install optional [funasr] for real ASR",
    )
    return [seg], "stub"


def transcribe_upload(upload_path: Path, work_dir: Path) -> TranscriptionResult:
    """
    Normalize `upload_path` to 16 kHz mono WAV under `work_dir`, then run ASR.
    """
    warnings: list[str] = []
    if not ffmpeg_audio.ffmpeg_available():
        return TranscriptionResult(
            segments=[],
            full_text="",
            engine="none",
            duration_sec=None,
            error=TranscriptionError(code="ffmpeg_not_found", message="未在 PATH 中找到 ffmpeg/ffprobe"),
            warnings=warnings,
        )

    normalized = work_dir / "normalized.wav"
    try:
        ffmpeg_audio.normalize_to_wav_16k_mono(upload_path, normalized)
    except RuntimeError as e:
        code = str(e)
        return TranscriptionResult(
            segments=[],
            full_text="",
            engine="none",
            duration_sec=None,
            error=TranscriptionError(code="ffmpeg_error", message=code),
            warnings=warnings,
        )

    duration = ffmpeg_audio.ffprobe_duration_sec(normalized)
    if duration is None:
        warnings.append("duration_unknown_after_normalize")

    segments: list[TranscriptionSegment] = []
    engine = "stub"

    try:
        from rushi_asr import funasr_engine

        segments, engine = funasr_engine.transcribe_with_funasr(normalized, duration)
    except RuntimeError as e:
        msg = str(e)
        if msg == "funasr_model_not_configured":
            segments, engine = _stub_segments(duration)
        else:
            warnings.append(f"funasr_skipped:{msg}")
            log.info("funasr skipped: %s", msg)
            segments, engine = _stub_segments(duration)
    except Exception as e:  # noqa: BLE001 — surface as warning + stub
        warnings.append(f"funasr_error:{e!s}")
        log.exception("funasr failed")
        segments, engine = _stub_segments(duration)

    full_text = "".join(s.text for s in segments)
    return TranscriptionResult(
        segments=segments,
        full_text=full_text,
        engine=engine,
        duration_sec=duration,
        warnings=warnings,
    )

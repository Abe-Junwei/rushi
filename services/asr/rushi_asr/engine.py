"""Orchestrate FFmpeg normalization + stub or FunASR transcription."""

from __future__ import annotations

import logging
from pathlib import Path

from rushi_asr import ffmpeg_audio
from rushi_asr.schemas import TranscriptionError, TranscriptionResult, TranscriptionSegment

log = logging.getLogger(__name__)


def _stub_segments(duration_sec: float | None) -> tuple[list[TranscriptionSegment], str]:
    """Pipeline OK but no ASR model: empty text with explicit low-confidence (P0 可降级置信度)."""
    end = duration_sec if duration_sec is not None and duration_sec > 0 else 0.01
    seg = TranscriptionSegment(
        start_sec=0.0,
        end_sec=float(end),
        text="",
        confidence=None,
        low_confidence=True,
        detail="stub: 未安装 FunASR 或引擎不可用；安装 pip install -e \".[funasr]\" 后重启 ASR（可选设置 RUSHI_FUNASR_MODEL 覆盖默认模型）",
    )
    return [seg], "stub"


def transcribe_upload(
    upload_path: Path,
    work_dir: Path,
    hotwords: str | None = None,
) -> TranscriptionResult:
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
    hw_norm = (hotwords or "").strip()
    if len(hw_norm) > 12_000:
        hw_norm = hw_norm[:12_000]
        while hw_norm and not hw_norm.is_char_boundary(len(hw_norm)):
            hw_norm = hw_norm[:-1]
        warnings.append("hotwords_truncated_12k")

    try:
        from rushi_asr import funasr_engine

        segments, engine = funasr_engine.transcribe_with_funasr(
            normalized,
            duration,
            hotwords=hw_norm or None,
            out_warnings=warnings,
        )
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

    if hw_norm and engine == "stub":
        warnings.append("hotwords_ignored_stub")

    full_text = "".join(s.text for s in segments)
    return TranscriptionResult(
        segments=segments,
        full_text=full_text,
        engine=engine,
        duration_sec=duration,
        warnings=warnings,
    )

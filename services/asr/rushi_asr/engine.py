"""Orchestrate FFmpeg normalization + stub or FunASR transcription."""

from __future__ import annotations

import logging
from pathlib import Path

from rushi_asr import ffmpeg_audio
from rushi_asr.schemas import TranscriptionError, TranscriptionResult, TranscriptionSegment

log = logging.getLogger(__name__)

# Aligned with Rust HOTWORDS_MAX_CHARS in glossary_hotwords.rs
HOTWORDS_MAX_CHARS = 12_000


def _stub_segments(_duration_sec: float | None) -> tuple[list[TranscriptionSegment], str]:
    """Pipeline OK but no ASR model：不注入整轨占位语段，由桌面端用波形拖选自建。"""
    return [], "stub"


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
    source_duration = ffmpeg_audio.ffprobe_duration_sec(upload_path)
    try:
        ffmpeg_audio.normalize_to_wav_16k_mono(upload_path, normalized)
    except RuntimeError as e:
        if normalized.exists():
            try:
                normalized.unlink(missing_ok=True)
            except OSError:
                pass
        code = str(e)
        return TranscriptionResult(
            segments=[],
            full_text="",
            engine="none",
            duration_sec=None,
            error=TranscriptionError(code="ffmpeg_error", message=code),
            warnings=warnings,
        )

    duration = ffmpeg_audio.ffprobe_duration_sec(normalized) or source_duration
    if duration is not None and duration <= 0:
        return TranscriptionResult(
            segments=[],
            full_text="",
            engine="none",
            duration_sec=duration,
            error=TranscriptionError(
                code="invalid_duration",
                message="规范化后音频时长无效（≤0），请检查源文件。",
            ),
            warnings=warnings,
        )
    if duration is None:
        warnings.append("duration_unknown_after_normalize")

    segments: list[TranscriptionSegment] = []
    engine = "stub"
    segmentation_mode: str | None = None
    hw_norm = (hotwords or "").strip()
    if len(hw_norm) > HOTWORDS_MAX_CHARS:
        hw_norm = hw_norm[:HOTWORDS_MAX_CHARS]
        warnings.append("hotwords_truncated_12k")

    try:
        from rushi_asr import funasr_engine

        segments, engine, segmentation_mode = funasr_engine.transcribe_with_funasr(
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

    if not segments and engine == "stub":
        warnings.append(
            "stub_no_placeholder_segment: FunASR 未安装、运行时不可用，或当前模型尚未准备完成；"
            "可在桌面端波形空白处拖选新建语段，或先完成 FunASR 安装与模型准备后再重试。",
        )

    if hw_norm and engine == "stub":
        warnings.append("hotwords_ignored_stub")

    full_text = "".join(s.text for s in segments)
    return TranscriptionResult(
        segments=segments,
        full_text=full_text,
        engine=engine,
        duration_sec=duration,
        warnings=warnings,
        segmentation_mode=segmentation_mode,
    )

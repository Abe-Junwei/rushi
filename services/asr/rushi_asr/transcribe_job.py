"""R3e-C: async transcribe job tracker (poll status + incremental segments_delta)."""

from __future__ import annotations

import logging
import os
import shutil
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from rushi_asr.schemas import TranscriptionError, TranscriptionResult, TranscriptionSegment
from rushi_asr.transcribe_windows import TranscribeCancelledError

log = logging.getLogger(__name__)

_lock = threading.Lock()
_jobs: dict[str, "_JobRecord"] = {}
_MAX_ACTIVE_JOBS = int(os.environ.get("RUSHI_MAX_TRANSCRIBE_JOBS", "1"))


@dataclass
class _JobRecord:
    job_id: str
    phase: str = "queued"
    message: str = ""
    window_index: int = 0
    window_count: int = 0
    segments: list[TranscriptionSegment] = field(default_factory=list)
    pending_delta: list[TranscriptionSegment] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    engine: str = ""
    segmentation_mode: str | None = None
    duration_sec: float | None = None
    error: TranscriptionError | None = None
    cancel_requested: bool = False
    thread: threading.Thread | None = None


def _should_cancel(job: _JobRecord) -> bool:
    with _lock:
        return job.cancel_requested


def _append_window_segments(
    job: _JobRecord,
    window_index: int,
    window_count: int,
    delta: list[TranscriptionSegment],
) -> None:
    with _lock:
        job.window_index = window_index
        job.window_count = window_count
        job.segments.extend(delta)
        job.pending_delta.extend(delta)
        job.phase = "transcribing"


def _run_job(job_id: str, upload_path: Path, work_dir: Path, hotwords: str | None) -> None:
    job = _jobs[job_id]
    try:
        with _lock:
            job.phase = "normalizing"
            job.message = "normalizing"

        result = _transcribe_with_progress(
            upload_path,
            work_dir,
            hotwords,
            on_window_done=lambda i, n, delta: _append_window_segments(job, i, n, delta),
            should_cancel=lambda: _should_cancel(job),
            on_phase=lambda phase, message: _set_phase(job, phase, message),
            on_windows_planned=lambda n: _set_window_count(job, n),
        )
        with _lock:
            job.engine = result.engine
            job.segmentation_mode = result.segmentation_mode
            job.duration_sec = result.duration_sec
            job.warnings = list(result.warnings)
            if result.error is not None:
                job.error = result.error
                job.phase = "error"
                job.message = result.error.message
                return
            # Final segments may differ from accumulated if non-windowed single shot
            if len(result.segments) != len(job.segments):
                job.segments = list(result.segments)
                job.pending_delta = list(result.segments)
            job.phase = "done"
            job.message = "ok"
    except TranscribeCancelledError:
        log.info("transcribe job %s cancelled", job_id)
        with _lock:
            job.phase = "cancelled"
            job.message = "cancelled"
            job.error = TranscriptionError(code="transcribe_cancelled", message="转写已取消")
    except Exception as e:  # noqa: BLE001
        log.exception("transcribe job %s failed", job_id)
        with _lock:
            job.phase = "error"
            job.message = repr(e)
            job.error = TranscriptionError(
                code=str(e) if isinstance(e, RuntimeError) else "transcribe_job_failed",
                message=str(e),
            )
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _set_phase(job: _JobRecord, phase: str, message: str) -> None:
    with _lock:
        job.phase = phase
        job.message = message


def _set_window_count(job: _JobRecord, window_count: int) -> None:
    with _lock:
        job.window_count = window_count


_TERMINAL_PHASES = frozenset({"done", "error", "cancelled"})


def _prune_terminal_jobs(max_jobs: int = 48) -> None:
    """Drop finished jobs when the in-memory map grows too large."""
    with _lock:
        if len(_jobs) <= max_jobs:
            return
        for job_id in list(_jobs.keys()):
            if _jobs[job_id].phase in _TERMINAL_PHASES:
                del _jobs[job_id]
            if len(_jobs) <= max_jobs // 2:
                break


def _active_job_count_locked() -> int:
    return sum(1 for job in _jobs.values() if job.phase not in _TERMINAL_PHASES)


def _transcribe_with_progress(
    upload_path: Path,
    work_dir: Path,
    hotwords: str | None,
    *,
    on_window_done: Callable[[int, int, list[TranscriptionSegment]], None],
    should_cancel: Callable[[], bool],
    on_phase: Callable[[str, str], None],
    on_windows_planned: Callable[[int], None] | None = None,
) -> TranscriptionResult:
    """Mirror ``engine.transcribe_upload`` but report window progress."""
    from rushi_asr import engine, ffmpeg_audio
    from rushi_asr.transcribe_windows import (
        should_transcribe_by_windows_async,
        transcribe_by_windows,
    )

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
        return TranscriptionResult(
            segments=[],
            full_text="",
            engine="none",
            duration_sec=None,
            error=TranscriptionError(code="ffmpeg_error", message=str(e)),
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

    hw_norm = (hotwords or "").strip()
    if len(hw_norm) > engine.HOTWORDS_MAX_CHARS:
        hw_norm = hw_norm[: engine.HOTWORDS_MAX_CHARS]
        warnings.append("hotwords_truncated_12k")

    on_phase("transcribing", "transcribing")
    segments: list[TranscriptionSegment] = []
    engine_label = "stub"
    segmentation_mode: str | None = None

    try:
        from rushi_asr import funasr_engine

        if should_transcribe_by_windows_async(duration):
            from rushi_asr.transcribe_windows import async_window_sec, plan_windows, transcribe_by_windows

            slice_sec = async_window_sec()
            if duration is not None and on_windows_planned is not None:
                planned = plan_windows(float(duration), slice_sec)
                if planned:
                    on_windows_planned(len(planned))
            segs, engine_label, segmentation_mode = transcribe_by_windows(
                normalized,
                float(duration),
                hotwords=hw_norm or None,
                out_warnings=warnings,
                on_window_done=on_window_done,
                should_cancel=should_cancel,
                slice_sec=async_window_sec(),
            )
            segments = segs
        else:
            if on_windows_planned is not None:
                on_windows_planned(1)
            if should_cancel():
                raise TranscribeCancelledError()
            segs, engine_label, segmentation_mode = funasr_engine.transcribe_with_funasr(
                normalized,
                duration,
                hotwords=hw_norm or None,
                out_warnings=warnings,
            )
            segments = segs
            on_window_done(1, 1, list(segs))
    except TranscribeCancelledError:
        raise
    except RuntimeError as e:
        msg = str(e)
        if msg == "funasr_model_not_configured":
            segments, engine_label = engine._stub_segments(duration)  # noqa: SLF001
        else:
            warnings.append(f"funasr_skipped:{msg}")
            segments, engine_label = engine._stub_segments(duration)  # noqa: SLF001
    except Exception as e:  # noqa: BLE001
        warnings.append(f"funasr_error:{e!s}")
        segments, engine_label = engine._stub_segments(duration)  # noqa: SLF001

    if not segments and engine_label == "stub":
        warnings.append(
            "stub_no_placeholder_segment: FunASR 未安装、运行时不可用，或当前模型尚未准备完成；"
            "可在桌面端波形空白处拖选新建语段，或先完成 FunASR 安装与模型准备后再重试。",
        )

    full_text = "".join(s.text for s in segments)
    return TranscriptionResult(
        segments=segments,
        full_text=full_text,
        engine=engine_label,
        duration_sec=duration,
        warnings=warnings,
        segmentation_mode=segmentation_mode,
    )


def start_transcribe_async(
    upload_path: Path,
    work_dir: Path,
    hotwords: str | None,
) -> dict[str, Any]:
    """Spawn background transcribe; poll ``transcribe_status`` until terminal phase."""
    _prune_terminal_jobs()
    job_id = str(uuid.uuid4())
    record = _JobRecord(job_id=job_id, phase="queued", message="queued")
    with _lock:
        if _active_job_count_locked() >= _MAX_ACTIVE_JOBS:
            raise RuntimeError("transcribe_job_limit")
        _jobs[job_id] = record

    t = threading.Thread(
        target=_run_job,
        args=(job_id, upload_path, work_dir, hotwords),
        name=f"rushi-transcribe-{job_id[:8]}",
        daemon=True,
    )
    record.thread = t
    t.start()
    return {"job_id": job_id, "schema_version": "1", "accepted": True}


def transcribe_status(job_id: str) -> dict[str, Any]:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return {"job_id": job_id, "phase": "unknown", "error": {"code": "unknown_job", "message": "job not found"}}
        delta = [s.model_dump() for s in job.pending_delta]
        body: dict[str, Any] = {
            "job_id": job_id,
            "schema_version": "1",
            "phase": job.phase,
            "message": job.message,
            "window_index": job.window_index,
            "window_count": job.window_count,
            "segments_delta": delta,
            "segments_total": len(job.segments),
            "warnings": list(job.warnings),
            "engine": job.engine or None,
            "segmentation_mode": job.segmentation_mode,
            "duration_sec": job.duration_sec,
            "error": job.error.model_dump() if job.error else None,
        }
        if job.phase == "done":
            body["segments"] = [s.model_dump() for s in job.segments]
            body["full_text"] = "".join(s.text for s in job.segments)
        return body


def cancel_transcribe(job_id: str) -> dict[str, Any]:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return {"cancelled": False, "reason": "unknown_job"}
        if job.phase in ("done", "error", "cancelled"):
            return {"cancelled": False, "reason": f"already_{job.phase}"}
        job.cancel_requested = True
    return {"cancelled": True, "job_id": job_id}


def reset_transcribe_jobs_for_tests() -> None:
    """Test helper: drop in-memory jobs."""
    with _lock:
        _jobs.clear()

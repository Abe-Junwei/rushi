"""Byte-accurate download progress for ModelScope ``snapshot_download`` (prepare UI)."""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from modelscope.hub.callback import ProgressCallback

class PrepareCancelledError(RuntimeError):
    """User requested stop of an in-flight ModelScope prefetch."""


_cancel_event = threading.Event()


def clear_prepare_cancel() -> None:
    _cancel_event.clear()


def request_prepare_cancel() -> None:
    _cancel_event.set()


def raise_if_prepare_cancelled() -> None:
    if _cancel_event.is_set():
        raise PrepareCancelledError("model_prepare_cancelled")


# Rough budgets when remote Content-Length is missing (bytes).
_RECOGNIZER_BUDGET_BYTES = 130 * 1024 * 1024
_VAD_BUDGET_BYTES = 8 * 1024 * 1024
_PUNC_BUDGET_BYTES = 50 * 1024 * 1024
_FORCED_ALIGNER_BUDGET_BYTES = 700 * 1024 * 1024


class ModelPrepareProgressTracker:
    """Thread-safe aggregate of per-file ModelScope download callbacks."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._bytes_downloaded = 0
        self._declared_total = 0
        self._budget_total = 0
        self._progress_percent: int | None = None

    def reset(
        self,
        *,
        include_vad: bool,
        include_punc: bool = False,
        include_forced_aligner: bool = False,
    ) -> None:
        with self._lock:
            self._bytes_downloaded = 0
            self._declared_total = 0
            self._budget_total = _RECOGNIZER_BUDGET_BYTES
            if include_vad:
                self._budget_total += _VAD_BUDGET_BYTES
            if include_punc:
                self._budget_total += _PUNC_BUDGET_BYTES
            if include_forced_aligner:
                self._budget_total += _FORCED_ALIGNER_BUDGET_BYTES
            self._progress_percent = 0

    def register_file(self, _filename: str, file_size: int) -> None:
        with self._lock:
            if file_size > 0:
                self._declared_total += file_size
            self._sync_percent()

    def add_bytes(self, size: int) -> None:
        if size <= 0:
            return
        with self._lock:
            self._bytes_downloaded += size
            self._sync_percent()

    def end_file(self) -> None:
        return

    def finalize_success(self) -> None:
        with self._lock:
            total = self._effective_total()
            self._bytes_downloaded = max(self._bytes_downloaded, total)
            self._progress_percent = 100

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            total = self._effective_total()
            return {
                "progress_percent": self._progress_percent,
                "bytes_downloaded": self._bytes_downloaded,
                "bytes_total": total,
            }

    def _effective_total(self) -> int:
        dynamic = max(self._declared_total, self._bytes_downloaded)
        return max(self._budget_total, dynamic, 1)

    def _sync_percent(self) -> None:
        total = self._effective_total()
        done = min(self._bytes_downloaded, total)
        self._progress_percent = min(99, int(done * 100 / total))


_tracker = ModelPrepareProgressTracker()


def reset_prepare_download_progress(
    *,
    include_vad: bool,
    include_punc: bool = False,
    include_forced_aligner: bool = False,
) -> None:
    _tracker.reset(
        include_vad=include_vad,
        include_punc=include_punc,
        include_forced_aligner=include_forced_aligner,
    )


def finalize_prepare_download_progress() -> None:
    _tracker.finalize_success()


def prepare_progress_snapshot() -> dict[str, Any]:
    return _tracker.snapshot()


def prepare_progress_callback_types() -> list[type[ProgressCallback]]:
    from modelscope.hub.callback import ProgressCallback

    tracker = _tracker

    class ModelPrepareProgressCallback(ProgressCallback):
        def __init__(self, filename: str, file_size: int) -> None:
            super().__init__(filename, file_size)
            tracker.register_file(filename, file_size)

        def update(self, size: int) -> None:
            raise_if_prepare_cancelled()
            tracker.add_bytes(size)

        def end(self) -> None:
            tracker.end_file()

    return [ModelPrepareProgressCallback]

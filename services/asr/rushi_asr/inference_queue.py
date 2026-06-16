"""Single-worker FIFO queue for FunASR inference (AutoModel is not thread-safe)."""

from __future__ import annotations

import concurrent.futures
import os
import queue
import threading
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")

_SENTINEL = object()


class SingleWorkerInferenceQueue:
    """Serializes inference calls on one background thread with explicit queue depth."""

    def __init__(self) -> None:
        self._tasks: queue.Queue[tuple[Callable[[], Any], concurrent.futures.Future[Any]] | object] = (
            queue.Queue()
        )
        self._stats_lock = threading.Lock()
        self._queued = 0
        self._running = False
        self._closed = False
        self._stopped = False
        self._worker = threading.Thread(
            target=self._worker_loop,
            name="rushi-funasr-inference",
            daemon=True,
        )
        self._worker.start()

    def _worker_loop(self) -> None:
        while True:
            item = self._tasks.get()
            try:
                if item is _SENTINEL:
                    with self._stats_lock:
                        self._stopped = True
                    return
                fn, future = item  # type: ignore[misc]
                if future.cancelled():
                    continue
                if not future.set_running_or_notify_cancel():
                    continue
                with self._stats_lock:
                    self._queued = max(0, self._queued - 1)
                    self._running = True
                try:
                    future.set_result(fn())
                except Exception as exc:  # noqa: BLE001
                    future.set_exception(exc)
                finally:
                    with self._stats_lock:
                        self._running = False
            finally:
                self._tasks.task_done()

    def submit(self, fn: Callable[[], T]) -> concurrent.futures.Future[T]:
        future: concurrent.futures.Future[T] = concurrent.futures.Future()
        with self._stats_lock:
            if self._closed:
                raise RuntimeError("inference_queue_shutdown")
            self._queued += 1
        self._tasks.put((fn, future))
        return future

    def stats(self) -> dict[str, int]:
        with self._stats_lock:
            pending = self._queued + (1 if self._running else 0)
            return {
                "inference_queue_pending": pending,
                "inference_queue_running": 1 if self._running else 0,
                "inference_requested_workers": requested_inference_workers(),
                "inference_max_workers": 1,
            }

    def is_running(self) -> bool:
        with self._stats_lock:
            return self._running

    def is_stopped(self) -> bool:
        with self._stats_lock:
            return self._stopped

    def shutdown(self, *, discard_pending: bool) -> None:
        with self._stats_lock:
            self._closed = True
        while True:
            try:
                item = self._tasks.get_nowait()
            except queue.Empty:
                break
            if item is _SENTINEL:
                continue
            _fn, future = item  # type: ignore[misc]
            if discard_pending and not future.done():
                future.set_exception(RuntimeError("inference_queue_reset"))
            self._tasks.task_done()
        self._tasks.put(_SENTINEL)


_queue: SingleWorkerInferenceQueue | None = None
_queue_lock = threading.Lock()


def get_inference_queue() -> SingleWorkerInferenceQueue:
    global _queue
    with _queue_lock:
        if _queue is None or _queue.is_stopped():
            _queue = SingleWorkerInferenceQueue()
        return _queue


def reset_inference_queue_after_timeout() -> None:
    """Drop queued work after timeout without starting a second model.generate worker."""
    global _queue
    with _queue_lock:
        if _queue is None:
            _queue = SingleWorkerInferenceQueue()
            return
        was_running = _queue.is_running()
        _queue.shutdown(discard_pending=True)
        if not was_running:
            _queue = SingleWorkerInferenceQueue()


def inference_queue_stats() -> dict[str, int]:
    with _queue_lock:
        if _queue is None:
            return {
                "inference_queue_pending": 0,
                "inference_queue_running": 0,
                "inference_requested_workers": requested_inference_workers(),
                "inference_max_workers": 1,
            }
        return _queue.stats()


def requested_inference_workers() -> int:
    """Requested workers are reported for diagnostics, but real FunASR stays single-worker."""
    raw = os.environ.get("RUSHI_FUNASR_INFERENCE_WORKERS", "").strip()
    if not raw:
        return 1
    try:
        return max(1, int(raw))
    except ValueError:
        return 1

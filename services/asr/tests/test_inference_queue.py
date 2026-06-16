from __future__ import annotations

import threading
import time

from rushi_asr.inference_queue import (
    SingleWorkerInferenceQueue,
    get_inference_queue,
    inference_queue_stats,
    requested_inference_workers,
    reset_inference_queue_after_timeout,
)


def test_inference_queue_runs_tasks_serially() -> None:
    q = SingleWorkerInferenceQueue()
    order: list[int] = []
    lock = threading.Lock()

    def task(n: int) -> int:
        with lock:
            order.append(n)
        time.sleep(0.01)
        return n

    futures = [q.submit(lambda n=n: task(n)) for n in (1, 2, 3)]
    assert [f.result(timeout=2) for f in futures] == [1, 2, 3]
    assert order == [1, 2, 3]
    q.shutdown(discard_pending=False)


def test_inference_queue_stats_track_pending() -> None:
    started = threading.Event()
    release = threading.Event()
    q = SingleWorkerInferenceQueue()

    def slow_task() -> str:
        started.set()
        release.wait(timeout=2)
        return "ok"

    first = q.submit(slow_task)
    assert started.wait(timeout=2)
    second = q.submit(lambda: "later")
    stats = q.stats()
    assert stats["inference_queue_running"] == 1
    assert stats["inference_queue_pending"] >= 2
    release.set()
    assert first.result(timeout=2) == "ok"
    assert second.result(timeout=2) == "later"
    q.shutdown(discard_pending=False)


def test_shutdown_discards_pending_futures() -> None:
    gate = threading.Event()
    q = SingleWorkerInferenceQueue()
    q.submit(lambda: gate.wait(timeout=2))
    pending = q.submit(lambda: "should-not-run")
    q.shutdown(discard_pending=True)
    gate.set()
    assert pending.done()
    assert isinstance(pending.exception(), RuntimeError)


def test_reset_after_timeout_does_not_start_parallel_worker() -> None:
    started = threading.Event()
    release = threading.Event()
    q = get_inference_queue()
    first = q.submit(lambda: (started.set(), release.wait(timeout=2))[1])
    assert started.wait(timeout=2)

    reset_inference_queue_after_timeout()
    assert inference_queue_stats()["inference_queue_running"] == 1
    try:
        q.submit(lambda: "blocked")
    except RuntimeError as exc:
        assert "inference_queue_shutdown" in str(exc)
    else:  # pragma: no cover - defensive
        raise AssertionError("timed-out worker should block new inference")

    release.set()
    assert first.result(timeout=2) is True


def test_requested_workers_are_diagnostic_only(monkeypatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_INFERENCE_WORKERS", "4")

    assert requested_inference_workers() == 4
    stats = inference_queue_stats()
    assert stats["inference_requested_workers"] == 4
    assert stats["inference_max_workers"] == 1

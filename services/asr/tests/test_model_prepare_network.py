from __future__ import annotations

from pathlib import Path

import pytest

from rushi_asr.model_prepare_network import is_transient_network_error, snapshot_download_with_retry
from rushi_asr.model_prepare_progress import PrepareCancelledError


def test_is_transient_network_error_classifies_common_failures() -> None:
    assert is_transient_network_error(ConnectionError("reset"))
    assert is_transient_network_error(TimeoutError())
    assert is_transient_network_error(OSError("network unreachable"))
    assert is_transient_network_error(RuntimeError("Connection reset by peer"))
    assert not is_transient_network_error(PrepareCancelledError())
    assert not is_transient_network_error(ValueError("bad model id"))


def test_snapshot_download_with_retry_retries_transient_errors() -> None:
    calls = {"n": 0}

    def flaky_download(model_id: str, *, progress_callbacks: list[object]) -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("reset by peer")
        return str(Path("/tmp") / model_id.replace("/", "_"))

    path = snapshot_download_with_retry(
        "iic/demo",
        flaky_download,
        [],
        max_attempts=3,
    )
    assert calls["n"] == 3
    assert path == Path("/tmp/iic_demo")


def test_snapshot_download_with_retry_maps_transient_exhaustion() -> None:
    def always_fail(model_id: str, *, progress_callbacks: list[object]) -> str:
        raise TimeoutError("timed out")

    with pytest.raises(RuntimeError, match="model_prepare_network_error"):
        snapshot_download_with_retry("iic/demo", always_fail, [], max_attempts=2)


def test_snapshot_download_with_retry_propagates_cancel() -> None:
    def cancelled(model_id: str, *, progress_callbacks: list[object]) -> str:
        raise PrepareCancelledError()

    with pytest.raises(PrepareCancelledError):
        snapshot_download_with_retry("iic/demo", cancelled, [], max_attempts=3)


def test_snapshot_download_with_retry_falls_back_without_progress_callbacks() -> None:
    """ModelScope hub no longer accepts ``progress_callbacks`` (CI 1.0.0 failure)."""
    calls: list[dict[str, object]] = []

    def modern_download(model_id: str, **kwargs: object) -> str:
        calls.append({"model_id": model_id, "kwargs": kwargs})
        if "progress_callbacks" in kwargs:
            raise TypeError("snapshot_download() got an unexpected keyword argument 'progress_callbacks'")
        return str(Path("/tmp") / model_id.replace("/", "_"))

    path = snapshot_download_with_retry("iic/demo", modern_download, ["cb"], max_attempts=1)
    assert path == Path("/tmp/iic_demo")
    assert len(calls) == 2
    assert "progress_callbacks" in calls[0]["kwargs"]
    assert calls[1]["kwargs"] == {}

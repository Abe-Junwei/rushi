"""In-memory prepare phase state (async coordinator)."""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any

from rushi_asr.model_prepare_progress import prepare_progress_snapshot

_lock = threading.Lock()
_state: dict[str, Any] = {
    "phase": "idle",
    "message": "",
    "error_code": None,
    "result": None,
}


def _touch_updated_at_locked() -> None:
    _state["updated_at_ms"] = int(time.time() * 1000)


def set_prepare_message(message: str) -> None:
    with _lock:
        if _state.get("phase") == "running":
            _state["message"] = message
            _touch_updated_at_locked()


def prepare_status_body() -> dict[str, Any]:
    with _lock:
        body: dict[str, Any] = {
            "phase": _state.get("phase", "idle"),
            "message": _state.get("message", ""),
            "error_code": _state.get("error_code"),
            "result": _state.get("result"),
            "job_id": _state.get("job_id"),
            "updated_at_ms": _state.get("updated_at_ms"),
        }
    if body["phase"] == "running":
        body.update(prepare_progress_snapshot())
        if isinstance(body.get("updated_at_ms"), int):
            body["stale"] = int(time.time() * 1000) - body["updated_at_ms"] > 120_000
    elif body["phase"] == "done":
        body["progress_percent"] = 100
    elif body["phase"] == "cancelled":
        body.update(prepare_progress_snapshot())
    return body


def prepare_phase() -> str:
    with _lock:
        return str(_state.get("phase", "idle"))


def try_begin_prepare_running() -> tuple[bool, str]:
    with _lock:
        if _state.get("phase") == "running":
            return False, str(_state.get("run_token") or "")
        run_token = uuid.uuid4().hex
        job_id = str(uuid.uuid4())
        _state.clear()
        _state.update(
            {
                "phase": "running",
                "message": "starting",
                "error_code": None,
                "result": None,
                "progress_percent": 0,
                "job_id": job_id,
                "run_token": run_token,
            },
        )
        _touch_updated_at_locked()
        return True, run_token


def finish_prepare_done(result: dict[str, Any], *, run_token: str) -> None:
    with _lock:
        if _state.get("run_token") != run_token:
            return
        job_id = _state.get("job_id")
        _state.clear()
        _state.update(
            {
                "phase": "done",
                "message": "ok",
                "error_code": None,
                "result": result,
                "progress_percent": 100,
                "job_id": job_id,
                "run_token": run_token,
            },
        )
        _touch_updated_at_locked()


def finish_prepare_cancelled(*, run_token: str) -> None:
    with _lock:
        if _state.get("run_token") != run_token:
            return
        job_id = _state.get("job_id")
        progress = prepare_progress_snapshot()
        _state.clear()
        _state.update(
            {
                "phase": "cancelled",
                "message": "cancelled",
                "error_code": "model_prepare_cancelled",
                "result": None,
                "job_id": job_id,
                "run_token": run_token,
                **progress,
            },
        )
        _touch_updated_at_locked()


def finish_prepare_error(code: str, message: str, *, run_token: str) -> None:
    with _lock:
        if _state.get("run_token") != run_token:
            return
        job_id = _state.get("job_id")
        _state.clear()
        _state.update(
            {
                "phase": "error",
                "message": message,
                "error_code": code,
                "result": None,
                "job_id": job_id,
                "run_token": run_token,
            },
        )
        _touch_updated_at_locked()


def reset_prepare_idle_state() -> None:
    with _lock:
        _state.clear()
        _state.update(
            {
                "phase": "idle",
                "message": "",
                "error_code": None,
                "result": None,
            },
        )


def prepare_run_token_active(run_token: str) -> bool:
    with _lock:
        return _state.get("run_token") == run_token and _state.get("phase") == "running"


class PrepareRunStaleError(RuntimeError):
    """Download thread superseded by a newer prepare coordinator run."""


def raise_if_prepare_run_stale(run_token: str) -> None:
    if not prepare_run_token_active(run_token):
        raise PrepareRunStaleError("model_prepare_superseded")


def set_prepare_cancelling_message() -> None:
    with _lock:
        if _state.get("phase") == "running":
            _state["message"] = "cancelling"
            _touch_updated_at_locked()

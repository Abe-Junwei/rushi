"""In-memory prepare phase state (async coordinator)."""

from __future__ import annotations

import threading
from typing import Any

from rushi_asr.model_prepare_progress import prepare_progress_snapshot

_lock = threading.Lock()
_state: dict[str, Any] = {
    "phase": "idle",
    "message": "",
    "error_code": None,
    "result": None,
}


def set_prepare_message(message: str) -> None:
    with _lock:
        if _state.get("phase") == "running":
            _state["message"] = message


def prepare_status_body() -> dict[str, Any]:
    with _lock:
        body: dict[str, Any] = {
            "phase": _state.get("phase", "idle"),
            "message": _state.get("message", ""),
            "error_code": _state.get("error_code"),
            "result": _state.get("result"),
        }
    if body["phase"] == "running":
        body.update(prepare_progress_snapshot())
    elif body["phase"] == "done":
        body["progress_percent"] = 100
    return body


def prepare_phase() -> str:
    with _lock:
        return str(_state.get("phase", "idle"))


def try_begin_prepare_running() -> bool:
    with _lock:
        if _state.get("phase") == "running":
            return False
        _state.clear()
        _state.update(
            {
                "phase": "running",
                "message": "starting",
                "error_code": None,
                "result": None,
                "progress_percent": 0,
            },
        )
        return True


def finish_prepare_done(result: dict[str, Any]) -> None:
    with _lock:
        _state.clear()
        _state.update(
            {
                "phase": "done",
                "message": "ok",
                "error_code": None,
                "result": result,
                "progress_percent": 100,
            },
        )


def finish_prepare_cancelled() -> None:
    with _lock:
        _state.clear()
        _state.update(
            {
                "phase": "cancelled",
                "message": "cancelled",
                "error_code": "model_prepare_cancelled",
                "result": None,
            },
        )


def finish_prepare_error(code: str, message: str) -> None:
    with _lock:
        _state.clear()
        _state.update(
            {
                "phase": "error",
                "message": message,
                "error_code": code,
                "result": None,
            },
        )


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


def set_prepare_cancelling_message() -> None:
    with _lock:
        if _state.get("phase") == "running":
            _state["message"] = "cancelling"

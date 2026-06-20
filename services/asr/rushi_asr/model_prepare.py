"""Download default FunASR weights into MODELSCOPE_CACHE (loopback-only service)."""

from __future__ import annotations

import logging
import threading
from typing import Any

from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID, effective_funasr_vad_model_id
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id
from rushi_asr.model_catalog import resolve_hub_model_id
from rushi_asr.model_prepare_cache import (
    default_model_cached_guess,
    punc_model_cached_guess,
    recognizer_model_cached_guess,
    required_models_cached_guess,
    vad_model_cached_guess,
)
from rushi_asr.model_prepare_download import download_models
from rushi_asr.model_prepare_progress import (
    PrepareCancelledError,
    clear_prepare_cancel,
    request_prepare_cancel,
    reset_prepare_download_progress,
)
from rushi_asr.model_prepare_state import (
    finish_prepare_cancelled,
    finish_prepare_done,
    finish_prepare_error,
    prepare_phase,
    prepare_status_body,
    PrepareRunStaleError,
    reset_prepare_idle_state,
    set_prepare_cancelling_message,
    try_begin_prepare_running,
)

log = logging.getLogger(__name__)

_PREPARE_RUNNING_WAIT_SEC = 8.0


def _wait_prepare_not_running(*, timeout_sec: float = _PREPARE_RUNNING_WAIT_SEC) -> bool:
    import time

    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        if prepare_phase() != "running":
            return True
        time.sleep(0.25)
    return prepare_phase() != "running"


def _release_prepare_before_restart(*, force: bool) -> bool:
    phase = prepare_phase()
    if phase == "error":
        reset_prepare_idle_state()
        return True
    if phase != "running":
        return True
    if not force:
        return True
    request_prepare_cancel()
    if _wait_prepare_not_running():
        return True
    log.warning("model_prepare: force restart rejected; prior download still running")
    return False


def _wait_for_prepare_phase(*, poll_sec: float = 0.5, deadline_sec: float = 900.0) -> dict[str, Any]:
    import time

    deadline = time.monotonic() + deadline_sec
    while time.monotonic() < deadline:
        st = prepare_status()
        phase = st.get("phase")
        if phase == "done":
            result = st.get("result")
            if isinstance(result, dict):
                return result
            raise RuntimeError("model_prepare_failed")
        if phase == "cancelled":
            raise PrepareCancelledError()
        if phase == "error":
            raise RuntimeError(str(st.get("error_code") or "model_prepare_failed"))
        time.sleep(poll_sec)
    raise RuntimeError("model_prepare_timeout")


def prepare_model(model_id: str | None = None, *, force: bool = False) -> dict[str, Any]:
    """Blocking prefetch via the async coordinator (visible in prepare-status / cancellable)."""
    resolved_model_id = resolve_hub_model_id(model_id)
    started = start_prepare_async(model_id, force=force)
    if not started.get("started"):
        reason = started.get("reason")
        if reason == "already_running":
            return _wait_for_prepare_phase()
        raise RuntimeError(f"model_prepare_not_started:{reason}")
    return _wait_for_prepare_phase()


def prepare_default_model() -> dict[str, Any]:
    """Blocking prefetch for the effective default hub model."""
    return prepare_model(None)


def prepare_status() -> dict[str, Any]:
    return prepare_status_body()


def start_prepare_async(model_id: str | None = None, *, force: bool = False) -> dict[str, Any]:
    """Spawn background download; poll ``prepare_status()`` until ``done`` or ``error``."""
    resolved_model_id = resolve_hub_model_id(model_id)
    phase = prepare_phase()
    if phase == "running" and not force:
        return {"started": False, "reason": "already_running"}
    if not _release_prepare_before_restart(force=force or phase == "error"):
        return {"started": False, "reason": "prepare_stuck"}

    def _run(run_token: str) -> None:
        try:
            body = download_models(resolved_model_id, run_token=run_token)
            finish_prepare_done(body, run_token=run_token)
        except PrepareCancelledError:
            log.info("model_prepare async cancelled by user")
            finish_prepare_cancelled(run_token=run_token)
        except PrepareRunStaleError:
            log.info("model_prepare async superseded by newer run")
        except Exception as e:  # noqa: BLE001
            code = (
                str(e)
                if isinstance(e, (RuntimeError, ValueError, FileNotFoundError, OSError))
                else "model_prepare_failed"
            )
            log.exception("model_prepare async failed")
            finish_prepare_error(code, repr(e), run_token=run_token)
        finally:
            clear_prepare_cancel()

    began, run_token = try_begin_prepare_running()
    if not began:
        return {"started": False, "reason": "already_running"}
    clear_prepare_cancel()
    reset_prepare_download_progress(
        include_vad=bool(effective_funasr_vad_model_id()),
        include_punc=bool(effective_funasr_punc_model_id(resolved_model_id)),
    )

    t = threading.Thread(target=_run, args=(run_token,), name="rushi-model-prepare", daemon=True)
    t.start()
    return {"started": True, "model_id": resolved_model_id}


def start_prepare_default_async() -> dict[str, Any]:
    """Backward-compatible async prepare for the effective default hub model."""
    return start_prepare_async(None)


def cancel_prepare_async() -> dict[str, Any]:
    """Request cooperative cancel of the background ``start_prepare_async`` thread."""
    if prepare_phase() != "running":
        return {"cancelled": False, "reason": prepare_phase()}
    request_prepare_cancel()
    set_prepare_cancelling_message()
    return {"cancelled": True}


__all__ = [
    "DEFAULT_FUNASR_MODEL_ID",
    "cancel_prepare_async",
    "default_model_cached_guess",
    "prepare_default_model",
    "prepare_model",
    "prepare_status",
    "punc_model_cached_guess",
    "recognizer_model_cached_guess",
    "required_models_cached_guess",
    "reset_prepare_idle_state",
    "start_prepare_async",
    "start_prepare_default_async",
    "vad_model_cached_guess",
]

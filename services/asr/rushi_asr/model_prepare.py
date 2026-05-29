"""Download default FunASR weights into MODELSCOPE_CACHE (loopback-only service)."""

from __future__ import annotations

import logging
import os
import shutil
import socket
import threading
from pathlib import Path
from typing import Any

from rushi_asr.defaults import effective_funasr_vad_model_id
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id
from rushi_asr.model_catalog import resolve_hub_model_id
from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID
from rushi_asr.model_prepare_cache import (
    DEFAULT_MODEL_REQUIRED_FILES,
    DEFAULT_PUNC_REQUIRED_FILES,
    DEFAULT_VAD_REQUIRED_FILES,
    default_model_cached_guess,
    disk_check_path,
    looks_like_complete_model_dir,
    punc_model_cached_guess,
    recognizer_model_cached_guess,
    required_models_cached_guess,
    vad_model_cached_guess,
)
from rushi_asr.model_prepare_progress import (
    PrepareCancelledError,
    clear_prepare_cancel,
    finalize_prepare_download_progress,
    prepare_progress_callback_types,
    prepare_progress_snapshot,
    raise_if_prepare_cancelled,
    request_prepare_cancel,
    reset_prepare_download_progress,
)

log = logging.getLogger(__name__)

_MIN_FREE_BYTES = 512 * 1024 * 1024
_WARN_FREE_BYTES = 2 * 1024 * 1024 * 1024
_BUDGET_HINT_BYTES = 5 * 1024 * 1024 * 1024

_lock = threading.Lock()
_state: dict[str, Any] = {
    "phase": "idle",
    "message": "",
    "error_code": None,
    "result": None,
}


def _set_prepare_message(message: str) -> None:
    with _lock:
        if _state.get("phase") == "running":
            _state["message"] = message


def _disk_warnings() -> tuple[list[str], Path]:
    warnings: list[str] = []
    check = disk_check_path()
    try:
        usage = shutil.disk_usage(check)
    except OSError:
        usage = shutil.disk_usage(Path.home())
    free = usage.free
    if free < _MIN_FREE_BYTES:
        raise RuntimeError("model_prepare_disk_full")
    if free < _WARN_FREE_BYTES:
        warnings.append("low_disk_under_2gib_free")
    if free < _BUDGET_HINT_BYTES:
        warnings.append("disk_below_5gib_budget_hint")
    return warnings, check


def _maybe_verify_manifest(model_dir: Path) -> None:
    raw = os.environ.get("RUSHI_MODEL_VERIFY_MANIFEST", "").strip()
    if not raw:
        return
    mp = Path(raw)
    if not mp.is_file():
        raise RuntimeError("model_manifest_path_missing")
    from rushi_asr.model_manifest_verify import load_manifest, verify_manifest

    verify_manifest(model_dir, load_manifest(mp))


def _download_models(resolved_model_id: str) -> dict[str, Any]:
    """Download weights for one hub id (holds runtime lock for prepare vs inference)."""
    from rushi_asr.funasr_engine import invalidate_funasr_model_cache, runtime_lock

    with runtime_lock():
        warnings, _check = _disk_warnings()

        try:
            from modelscope.hub.snapshot_download import snapshot_download
        except ImportError as e:
            raise RuntimeError("modelscope_not_installed") from e

        log.info("model_prepare: snapshot_download %s", resolved_model_id)
        vad_model_id = effective_funasr_vad_model_id()
        punc_model_id = effective_funasr_punc_model_id(resolved_model_id)
        progress_callbacks = prepare_progress_callback_types()
        reset_prepare_download_progress(include_vad=bool(vad_model_id), include_punc=bool(punc_model_id))
        raise_if_prepare_cancelled()

        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(600)
        try:
            _set_prepare_message("downloading_recognizer")
            raise_if_prepare_cancelled()
            model_dir = Path(
                snapshot_download(
                    resolved_model_id,
                    progress_callbacks=progress_callbacks,
                ),
            )
            vad_dir: Path | None = None
            if vad_model_id:
                _set_prepare_message("downloading_vad")
                raise_if_prepare_cancelled()
                vad_dir = Path(
                    snapshot_download(
                        vad_model_id,
                        progress_callbacks=progress_callbacks,
                    ),
                )
            punc_dir: Path | None = None
            if punc_model_id:
                _set_prepare_message("downloading_punc")
                raise_if_prepare_cancelled()
                punc_dir = Path(
                    snapshot_download(
                        punc_model_id,
                        progress_callbacks=progress_callbacks,
                    ),
                )
        finally:
            socket.setdefaulttimeout(old_timeout)
        finalize_prepare_download_progress()
        raise_if_prepare_cancelled()
        if not looks_like_complete_model_dir(
            model_dir,
            DEFAULT_MODEL_REQUIRED_FILES,
            100 * 1024 * 1024,
        ):
            raise RuntimeError("model_prepare_incomplete")
        if vad_model_id and vad_dir is not None and not looks_like_complete_model_dir(
            vad_dir,
            DEFAULT_VAD_REQUIRED_FILES,
            1 * 1024 * 1024,
        ):
            raise RuntimeError("vad_prepare_incomplete")
        if punc_model_id and punc_dir is not None and not looks_like_complete_model_dir(
            punc_dir,
            DEFAULT_PUNC_REQUIRED_FILES,
            1 * 1024 * 1024,
        ):
            raise RuntimeError("punc_prepare_incomplete")
        _maybe_verify_manifest(model_dir)
        invalidate_funasr_model_cache()
        return {
            "status": "ok",
            "model_id": resolved_model_id,
            "path": str(model_dir),
            "vad_model_id": vad_model_id,
            "vad_path": str(vad_dir) if vad_dir is not None else None,
            "punc_model_id": punc_model_id,
            "punc_path": str(punc_dir) if punc_dir is not None else None,
            "required_models_cached": required_models_cached_guess(resolved_model_id),
            "warnings": warnings,
        }


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


def prepare_model(model_id: str | None = None) -> dict[str, Any]:
    """Blocking prefetch via the async coordinator (visible in prepare-status / cancellable)."""
    resolved_model_id = resolve_hub_model_id(model_id)
    started = start_prepare_async(model_id)
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


def start_prepare_async(model_id: str | None = None) -> dict[str, Any]:
    """Spawn background download; poll ``prepare_status()`` until ``done`` or ``error``."""
    resolved_model_id = resolve_hub_model_id(model_id)

    def _run() -> None:
        try:
            body = _download_models(resolved_model_id)
            with _lock:
                _state.clear()
                _state.update(
                    {
                        "phase": "done",
                        "message": "ok",
                        "error_code": None,
                        "result": body,
                        "progress_percent": 100,
                    },
                )
        except PrepareCancelledError:
            log.info("model_prepare async cancelled by user")
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
        except Exception as e:  # noqa: BLE001
            code = (
                str(e)
                if isinstance(e, (RuntimeError, ValueError, FileNotFoundError, OSError))
                else "model_prepare_failed"
            )
            log.exception("model_prepare async failed")
            with _lock:
                _state.clear()
                _state.update(
                    {
                        "phase": "error",
                        "message": repr(e),
                        "error_code": code,
                        "result": None,
                    },
                )
        finally:
            clear_prepare_cancel()

    with _lock:
        if _state.get("phase") == "running":
            return {"started": False, "reason": "already_running"}
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
        clear_prepare_cancel()
    reset_prepare_download_progress(
        include_vad=bool(effective_funasr_vad_model_id()),
        include_punc=bool(effective_funasr_punc_model_id(resolved_model_id)),
    )

    t = threading.Thread(target=_run, name="rushi-model-prepare", daemon=True)
    t.start()
    return {"started": True, "model_id": resolved_model_id}


def start_prepare_default_async() -> dict[str, Any]:
    """Backward-compatible async prepare for the effective default hub model."""
    return start_prepare_async(None)


def reset_prepare_idle_state() -> None:
    """Test / dev helper: clear in-memory prepare phase (does not cancel downloads)."""
    with _lock:
        _state.clear()
        _state.update(
            {
                "phase": "idle",
                "message": "",
                "error_code": None,
                "result": None,
            }
        )


def cancel_prepare_async() -> dict[str, Any]:
    """Request cooperative cancel of the background ``start_prepare_async`` thread."""
    with _lock:
        phase = str(_state.get("phase", "idle"))
        if phase != "running":
            return {"cancelled": False, "reason": phase}
    request_prepare_cancel()
    with _lock:
        if _state.get("phase") == "running":
            _state["message"] = "cancelling"
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

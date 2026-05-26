"""Download default FunASR weights into MODELSCOPE_CACHE (loopback-only service)."""

from __future__ import annotations

import logging
import os
import shutil
import threading
from pathlib import Path
from typing import Any

from rushi_asr.defaults import (
    DEFAULT_FUNASR_MODEL_ID,
    DEFAULT_FUNASR_VAD_MODEL_ID,
    effective_funasr_model_id,
    effective_funasr_vad_model_id,
)

log = logging.getLogger(__name__)

# Policy §0 / §8 rough guard (bytes).
_MIN_FREE_BYTES = 512 * 1024 * 1024
_WARN_FREE_BYTES = 2 * 1024 * 1024 * 1024
_BUDGET_HINT_BYTES = 5 * 1024 * 1024 * 1024
_DEFAULT_MODEL_REQUIRED_FILES = ("model.pt", "config.yaml", "tokens.json")
_DEFAULT_VAD_REQUIRED_FILES = ("model.pt",)

_lock = threading.Lock()
_state: dict[str, Any] = {
    "phase": "idle",  # idle | running | done | error
    "message": "",
    "error_code": None,
    "result": None,
}


def _disk_check_path() -> Path:
    raw = os.environ.get("RUSHI_MODELS_ROOT", "").strip()
    p = Path(raw) if raw else Path.home()
    try:
        p.mkdir(parents=True, exist_ok=True)
    except OSError:
        return Path.home()
    return p


def _model_dir_candidates(root: Path, model_id: str) -> list[Path]:
    parts = model_id.split("/", 1)
    if len(parts) != 2:
        return []
    owner, name = parts
    candidates = [
        root / "models" / owner / name,
        root / "hub" / "models" / owner / name,
        root / "hub" / owner / name,
    ]
    # Some ModelScope versions keep extra temp/lock directories nearby. Ignore them.
    try:
        for p in root.glob(f"**/{name}"):
            text = p.as_posix()
            if any(marker in text for marker in ("/._____temp/", "/.lock/")):
                continue
            candidates.append(p)
    except OSError:
        pass

    unique: list[Path] = []
    for p in candidates:
        if p not in unique:
            unique.append(p)
    return unique


def _looks_like_complete_model_dir(
    model_dir: Path,
    required_files: tuple[str, ...],
    min_model_bytes: int,
) -> bool:
    try:
        if not model_dir.is_dir():
            return False
        for rel in required_files:
            p = model_dir / rel
            if not p.is_file():
                return False
        return (model_dir / "model.pt").stat().st_size > min_model_bytes
    except OSError:
        return False


def _model_cached_guess(
    model_id: str,
    required_files: tuple[str, ...],
    min_model_bytes: int,
) -> bool:
    ms = os.environ.get("MODELSCOPE_CACHE", "").strip()
    if not ms:
        return False
    root = Path(ms)
    if not root.is_dir():
        return False
    for model_dir in _model_dir_candidates(root, model_id):
        if _looks_like_complete_model_dir(model_dir, required_files, min_model_bytes):
            return True
    return False


def recognizer_model_cached_guess(model_id: str | None = None) -> bool:
    resolved_model_id = (model_id or "").strip() or effective_funasr_model_id()
    if not resolved_model_id:
        return False
    return _model_cached_guess(
        resolved_model_id,
        _DEFAULT_MODEL_REQUIRED_FILES,
        100 * 1024 * 1024,
    )


def default_model_cached_guess() -> bool:
    """True when the default recognizer model looks fully cached in its final directory."""
    return recognizer_model_cached_guess(DEFAULT_FUNASR_MODEL_ID)


def vad_model_cached_guess() -> bool:
    vad_id = effective_funasr_vad_model_id()
    if not vad_id:
        return True
    return _model_cached_guess(vad_id, _DEFAULT_VAD_REQUIRED_FILES, 1 * 1024 * 1024)


def required_models_cached_guess(model_id: str | None = None) -> bool:
    return recognizer_model_cached_guess(model_id) and vad_model_cached_guess()


def _set_prepare_message(message: str) -> None:
    with _lock:
        if _state.get("phase") == "running":
            _state["message"] = message


def _disk_warnings() -> tuple[list[str], Path]:
    warnings: list[str] = []
    check = _disk_check_path()
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


def prepare_default_model() -> dict[str, Any]:
    """
    Blocking ``snapshot_download`` for ``DEFAULT_FUNASR_MODEL_ID`` (resume handled by ModelScope).
    """
    warnings, _check = _disk_warnings()

    try:
        from modelscope.hub.snapshot_download import snapshot_download
    except ImportError as e:
        raise RuntimeError("modelscope_not_installed") from e

    log.info("model_prepare: snapshot_download %s", DEFAULT_FUNASR_MODEL_ID)
    # snapshot_download 底层未暴露 timeout；通过 socket 全局超时兜底。
    import socket

    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(600)  # 10 min
    try:
        _set_prepare_message("downloading_recognizer")
        model_dir = Path(snapshot_download(DEFAULT_FUNASR_MODEL_ID))
        vad_model_id = effective_funasr_vad_model_id()
        vad_dir: Path | None = None
        if vad_model_id:
            _set_prepare_message("downloading_vad")
            vad_dir = Path(snapshot_download(vad_model_id))
    finally:
        socket.setdefaulttimeout(old_timeout)
    if not _looks_like_complete_model_dir(
        model_dir,
        _DEFAULT_MODEL_REQUIRED_FILES,
        100 * 1024 * 1024,
    ):
        raise RuntimeError("model_prepare_incomplete")
    if vad_model_id and vad_dir is not None and not _looks_like_complete_model_dir(
        vad_dir,
        _DEFAULT_VAD_REQUIRED_FILES,
        1 * 1024 * 1024,
    ):
        raise RuntimeError("vad_prepare_incomplete")
    _maybe_verify_manifest(model_dir)
    return {
        "status": "ok",
        "model_id": DEFAULT_FUNASR_MODEL_ID,
        "path": str(model_dir),
        "vad_model_id": vad_model_id,
        "vad_path": str(vad_dir) if vad_dir is not None else None,
        "required_models_cached": required_models_cached_guess(),
        "warnings": warnings,
    }


def prepare_status() -> dict[str, Any]:
    with _lock:
        return {
            "phase": _state.get("phase", "idle"),
            "message": _state.get("message", ""),
            "error_code": _state.get("error_code"),
            "result": _state.get("result"),
        }


def start_prepare_default_async() -> dict[str, Any]:
    """Spawn background download; poll ``prepare_status()`` until ``done`` or ``error``."""

    def _run() -> None:
        try:
            body = prepare_default_model()
            with _lock:
                _state.clear()
                _state.update(
                    {
                        "phase": "done",
                        "message": "ok",
                        "error_code": None,
                        "result": body,
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
            },
        )

    t = threading.Thread(target=_run, name="rushi-model-prepare", daemon=True)
    t.start()
    return {"started": True}

"""ModelScope snapshot download path for prepare (no async state)."""

from __future__ import annotations

import logging
import os
import shutil
import socket
from pathlib import Path
from typing import Any

from rushi_asr.defaults import effective_funasr_forced_aligner_id, effective_funasr_vad_model_id
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id
from rushi_asr.model_prepare_cache import (
    DEFAULT_PUNC_REQUIRED_FILES,
    DEFAULT_VAD_REQUIRED_FILES,
    disk_check_path,
    find_cached_model_dir,
    forced_aligner_model_cached_guess,
    looks_like_complete_model_dir,
    recognizer_cache_spec,
    required_models_cached_guess,
)
from rushi_asr.model_prepare_progress import (
    finalize_prepare_download_progress,
    prepare_progress_callback_types,
    raise_if_prepare_cancelled,
    reset_prepare_download_progress,
)
from rushi_asr.model_prepare_state import set_prepare_message

log = logging.getLogger(__name__)

_MIN_FREE_BYTES = 512 * 1024 * 1024
_WARN_FREE_BYTES = 2 * 1024 * 1024 * 1024
_BUDGET_HINT_BYTES = 5 * 1024 * 1024 * 1024


def disk_warnings() -> tuple[list[str], Path]:
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


def maybe_verify_manifest(model_dir: Path) -> None:
    raw = os.environ.get("RUSHI_MODEL_VERIFY_MANIFEST", "").strip()
    if not raw:
        return
    mp = Path(raw)
    if not mp.is_file():
        raise RuntimeError("model_manifest_path_missing")
    from rushi_asr.model_manifest_verify import load_manifest, verify_manifest

    verify_manifest(model_dir, load_manifest(mp))


def cached_hub_path(
    hub_id: str,
    *,
    required_files: tuple[str, ...] | None = None,
    min_weight_bytes: int | None = None,
    weight_file: str | None = None,
) -> Path | None:
    req = required_files
    weight = weight_file
    min_b = min_weight_bytes
    if req is None or weight is None or min_b is None:
        spec_req, spec_weight, spec_min = recognizer_cache_spec(hub_id)
        req = req or spec_req
        weight = weight or spec_weight
        min_b = min_b if min_b is not None else spec_min
    return find_cached_model_dir(hub_id, req, min_b, weight_file=weight)


def prepare_result_from_cache(resolved_model_id: str, warnings: list[str]) -> dict[str, Any] | None:
    if not required_models_cached_guess(resolved_model_id):
        return None
    model_dir = cached_hub_path(resolved_model_id)
    if model_dir is None:
        return None
    vad_model_id = effective_funasr_vad_model_id()
    punc_model_id = effective_funasr_punc_model_id(resolved_model_id)
    forced_aligner_id = effective_funasr_forced_aligner_id()
    vad_dir = (
        cached_hub_path(vad_model_id, required_files=DEFAULT_VAD_REQUIRED_FILES, min_weight_bytes=1 * 1024 * 1024)
        if vad_model_id
        else None
    )
    punc_dir = (
        cached_hub_path(punc_model_id, required_files=DEFAULT_PUNC_REQUIRED_FILES, min_weight_bytes=1 * 1024 * 1024)
        if punc_model_id
        else None
    )
    aligner_dir = cached_hub_path(forced_aligner_id) if forced_aligner_id else None
    log.info("model_prepare: all required models cached, skipping download")
    maybe_verify_manifest(model_dir)
    return {
        "status": "ok",
        "model_id": resolved_model_id,
        "path": str(model_dir),
        "vad_model_id": vad_model_id,
        "vad_path": str(vad_dir) if vad_dir is not None else None,
        "punc_model_id": punc_model_id,
        "punc_path": str(punc_dir) if punc_dir is not None else None,
        "forced_aligner_model_id": forced_aligner_id,
        "forced_aligner_path": str(aligner_dir) if aligner_dir is not None else None,
        "forced_aligner_cached": forced_aligner_model_cached_guess(),
        "required_models_cached": True,
        "cached_only": True,
        "warnings": warnings,
    }


def resolve_model_dir(
    model_id: str,
    *,
    snapshot_download: Any,
    progress_callbacks: tuple[Any, ...],
) -> Path:
    req_files, weight_file, min_weight = recognizer_cache_spec(model_id)
    cached = find_cached_model_dir(model_id, req_files, min_weight, weight_file=weight_file)
    if cached is not None:
        log.info("model_prepare: using cached %s at %s", model_id, cached)
        return cached
    return Path(snapshot_download(model_id, progress_callbacks=progress_callbacks))


def resolve_aux_model_dir(
    model_id: str,
    required_files: tuple[str, ...],
    min_weight_bytes: int,
    *,
    snapshot_download: Any,
    progress_callbacks: tuple[Any, ...],
    weight_file: str = "model.pt",
) -> Path:
    cached = find_cached_model_dir(model_id, required_files, min_weight_bytes, weight_file=weight_file)
    if cached is not None:
        log.info("model_prepare: using cached %s at %s", model_id, cached)
        return cached
    return Path(snapshot_download(model_id, progress_callbacks=progress_callbacks))


def download_models(resolved_model_id: str) -> dict[str, Any]:
    from rushi_asr.funasr_engine import invalidate_funasr_model_cache, runtime_lock

    with runtime_lock():
        warnings, _check = disk_warnings()

        cached_result = prepare_result_from_cache(resolved_model_id, warnings)
        if cached_result is not None:
            invalidate_funasr_model_cache()
            return cached_result

        try:
            from modelscope.hub.snapshot_download import snapshot_download
        except ImportError as e:
            raise RuntimeError("modelscope_not_installed") from e

        log.info("model_prepare: snapshot_download %s", resolved_model_id)
        vad_model_id = effective_funasr_vad_model_id()
        punc_model_id = effective_funasr_punc_model_id(resolved_model_id)
        forced_aligner_id = effective_funasr_forced_aligner_id()
        progress_callbacks = prepare_progress_callback_types()
        reset_prepare_download_progress(
            include_vad=bool(vad_model_id),
            include_punc=bool(punc_model_id),
            include_forced_aligner=bool(forced_aligner_id),
        )
        raise_if_prepare_cancelled()

        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(600)
        try:
            set_prepare_message("downloading_recognizer")
            raise_if_prepare_cancelled()
            model_dir = resolve_model_dir(
                resolved_model_id,
                snapshot_download=snapshot_download,
                progress_callbacks=progress_callbacks,
            )
            vad_dir: Path | None = None
            if vad_model_id:
                set_prepare_message("downloading_vad")
                raise_if_prepare_cancelled()
                vad_dir = resolve_aux_model_dir(
                    vad_model_id,
                    DEFAULT_VAD_REQUIRED_FILES,
                    1 * 1024 * 1024,
                    snapshot_download=snapshot_download,
                    progress_callbacks=progress_callbacks,
                )
            punc_dir: Path | None = None
            if punc_model_id:
                set_prepare_message("downloading_punc")
                raise_if_prepare_cancelled()
                punc_dir = resolve_aux_model_dir(
                    punc_model_id,
                    DEFAULT_PUNC_REQUIRED_FILES,
                    1 * 1024 * 1024,
                    snapshot_download=snapshot_download,
                    progress_callbacks=progress_callbacks,
                )
            aligner_dir: Path | None = None
            if forced_aligner_id:
                set_prepare_message("downloading_forced_aligner")
                raise_if_prepare_cancelled()
                aligner_dir = resolve_model_dir(
                    forced_aligner_id,
                    snapshot_download=snapshot_download,
                    progress_callbacks=progress_callbacks,
                )
        finally:
            socket.setdefaulttimeout(old_timeout)
        finalize_prepare_download_progress()
        raise_if_prepare_cancelled()
        req_files, weight_file, min_weight = recognizer_cache_spec(resolved_model_id)
        if not looks_like_complete_model_dir(model_dir, req_files, min_weight, weight_file=weight_file):
            raise RuntimeError("model_prepare_incomplete")
        if vad_model_id and vad_dir is not None and not looks_like_complete_model_dir(
            vad_dir, DEFAULT_VAD_REQUIRED_FILES, 1 * 1024 * 1024
        ):
            raise RuntimeError("vad_prepare_incomplete")
        if punc_model_id and punc_dir is not None and not looks_like_complete_model_dir(
            punc_dir, DEFAULT_PUNC_REQUIRED_FILES, 1 * 1024 * 1024
        ):
            raise RuntimeError("punc_prepare_incomplete")
        if forced_aligner_id and aligner_dir is not None:
            align_req, align_weight, align_min = recognizer_cache_spec(forced_aligner_id)
            if not looks_like_complete_model_dir(aligner_dir, align_req, align_min, weight_file=align_weight):
                raise RuntimeError("forced_aligner_prepare_incomplete")
        maybe_verify_manifest(model_dir)
        invalidate_funasr_model_cache()
        return {
            "status": "ok",
            "model_id": resolved_model_id,
            "path": str(model_dir),
            "vad_model_id": vad_model_id,
            "vad_path": str(vad_dir) if vad_dir is not None else None,
            "punc_model_id": punc_model_id,
            "punc_path": str(punc_dir) if punc_dir is not None else None,
            "forced_aligner_model_id": forced_aligner_id,
            "forced_aligner_path": str(aligner_dir) if aligner_dir is not None else None,
            "forced_aligner_cached": forced_aligner_model_cached_guess(),
            "required_models_cached": required_models_cached_guess(resolved_model_id),
            "warnings": warnings,
        }

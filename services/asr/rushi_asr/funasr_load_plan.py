"""Resolved FunASR AutoModel load arguments (local paths vs hub ids)."""

from __future__ import annotations

from typing import Any

from rushi_asr.defaults import effective_funasr_model_id, effective_funasr_vad_model_id
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id
from rushi_asr.model_prepare import required_models_cached_guess
from rushi_asr.model_prepare_cache import (
    DEFAULT_PUNC_REQUIRED_FILES,
    DEFAULT_VAD_REQUIRED_FILES,
    recognizer_model_cached_guess,
    resolve_funasr_automodel_arg,
    vad_model_cached_guess,
)


def build_funasr_load_plan(model_id: str | None = None) -> dict[str, Any]:
    """Return hub ids and AutoModel args for /health and warmup diagnostics."""
    mid = (model_id or "").strip() or effective_funasr_model_id()
    vad = effective_funasr_vad_model_id()
    punc = effective_funasr_punc_model_id(mid) if mid else None

    plan: dict[str, Any] = {
        "model_id": mid,
        "model_arg": resolve_funasr_automodel_arg(mid) if mid else None,
        "model_hub": None,
        "model_cached": recognizer_model_cached_guess(mid) if mid else False,
        "vad_model_id": vad,
        "vad_arg": None,
        "vad_cached": vad_model_cached_guess(),
        "punc_model_id": punc,
        "punc_arg": None,
    }
    if vad:
        plan["vad_arg"] = resolve_funasr_automodel_arg(
            vad,
            required_files=DEFAULT_VAD_REQUIRED_FILES,
            min_weight_bytes=1 * 1024 * 1024,
        )
    if punc:
        plan["punc_arg"] = resolve_funasr_automodel_arg(
            punc,
            required_files=DEFAULT_PUNC_REQUIRED_FILES,
            min_weight_bytes=1 * 1024 * 1024,
        )
    plan["weights_cached_locally"] = required_models_cached_guess(mid)
    # Back-compat alias; means weights on disk, not filesystem paths passed to AutoModel.
    plan["uses_local_paths"] = bool(plan["weights_cached_locally"])
    return plan

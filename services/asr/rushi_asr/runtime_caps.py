"""Runtime capabilities for /health (FunASR / ffmpeg) without loading models."""

from __future__ import annotations

import os
from importlib.metadata import PackageNotFoundError, version as _pkg_version


def sidecar_version() -> str:
    """Installed rushi-asr package version (for /health upgrade-compat checks)."""
    try:
        return _pkg_version("rushi-asr")
    except PackageNotFoundError:
        return "0+unknown"

from rushi_asr import ffmpeg_audio
from rushi_asr.defaults import effective_funasr_forced_aligner_id, effective_funasr_model_id, funasr_model_explicit_from_env
from rushi_asr.model_catalog import get_catalog_status
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id
from rushi_asr.funasr_engine import effective_funasr_language, loaded_funasr_model_id
from rushi_asr.funasr_load_plan import build_funasr_load_plan
from rushi_asr.inference_queue import inference_queue_stats
from rushi_asr.model_prepare import (
    default_model_cached_guess,
    forced_aligner_model_cached_guess,
    punc_model_cached_guess,
    recognizer_model_cached_guess,
    required_models_cached_guess,
    vad_model_cached_guess,
)


def get_runtime_caps() -> dict[str, object]:
    """Lightweight introspection for desktop auto-detect (no FunASR model load)."""
    ffmpeg_audio.ensure_ffmpeg_on_path()
    ffmpeg_ok = ffmpeg_audio.ffmpeg_available()
    ffmpeg_on_path = ffmpeg_audio.ffmpeg_on_path()
    try:
        import funasr  # noqa: F401, PLC0415 — optional heavy dep

        funasr_import_ok = True
    except ImportError:
        funasr_import_ok = False

    model = effective_funasr_model_id()
    funasr_model_configured = bool(model)
    default_model_cached = default_model_cached_guess()
    vad_model_cached = vad_model_cached_guess()
    punc_model_cached = punc_model_cached_guess(model)
    punc_model_id = effective_funasr_punc_model_id(model) if model else None
    required_models_cached = required_models_cached_guess(model)
    active_model_cached = recognizer_model_cached_guess(model)
    forced_aligner_id = effective_funasr_forced_aligner_id()
    forced_aligner_cached = forced_aligner_model_cached_guess()
    load_plan = build_funasr_load_plan(model)
    runtime_ready = bool(ffmpeg_ok and funasr_import_ok)
    ready_for_transcribe = bool(runtime_ready and required_models_cached and ffmpeg_on_path)
    transcription_mode: str = "funasr" if ready_for_transcribe else "stub"
    models_root = os.environ.get("RUSHI_MODELS_ROOT", "").strip() or None
    local_token_required = bool(os.environ.get("RUSHI_LOCAL_TOKEN", "").strip())

    return {
        "version": sidecar_version(),
        "ffmpeg_ok": ffmpeg_ok,
        "ffmpeg_on_path": ffmpeg_on_path,
        "funasr_import_ok": funasr_import_ok,
        "funasr_model_configured": funasr_model_configured,
        "funasr_model_explicit_from_env": funasr_model_explicit_from_env(),
        "funasr_default_model_cached": default_model_cached,
        "funasr_active_model_cached": active_model_cached,
        "funasr_vad_model_cached": vad_model_cached,
        "funasr_punc_model_cached": punc_model_cached,
        "funasr_punc_model_id": punc_model_id,
        "funasr_required_models_cached": required_models_cached,
        "funasr_forced_aligner_model_id": forced_aligner_id,
        "funasr_forced_aligner_cached": forced_aligner_cached,
        "funasr_load_plan": load_plan,
        "local_asr_model_catalog": get_catalog_status(model),
        "funasr_ready": runtime_ready,
        "ready_for_transcribe": ready_for_transcribe,
        "transcription_mode": transcription_mode,
        "funasr_model_id": model,
        "funasr_loaded_model_id": loaded_funasr_model_id(),
        "funasr_language": effective_funasr_language(),
        "rushi_models_root": models_root,
        "local_token_required": local_token_required,
        **inference_queue_stats(),
    }

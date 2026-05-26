"""Runtime capabilities for /health (FunASR / ffmpeg) without loading models."""

from __future__ import annotations

import os

from rushi_asr import ffmpeg_audio
from rushi_asr.defaults import effective_funasr_model_id, funasr_model_explicit_from_env
from rushi_asr.model_prepare import (
    default_model_cached_guess,
    required_models_cached_guess,
    vad_model_cached_guess,
)


def get_runtime_caps() -> dict[str, object]:
    """Lightweight introspection for desktop auto-detect (no FunASR model load)."""
    ffmpeg_ok = ffmpeg_audio.ffmpeg_available()
    try:
        import funasr  # noqa: F401, PLC0415 — optional heavy dep

        funasr_import_ok = True
    except ImportError:
        funasr_import_ok = False

    model = effective_funasr_model_id()
    funasr_model_configured = bool(model)
    default_model_cached = default_model_cached_guess()
    vad_model_cached = vad_model_cached_guess()
    required_models_cached = required_models_cached_guess()
    runtime_ready = bool(ffmpeg_ok and funasr_import_ok)
    ready_for_transcribe = bool(runtime_ready and required_models_cached)
    transcription_mode: str = "funasr" if ready_for_transcribe else "stub"
    models_root = os.environ.get("RUSHI_MODELS_ROOT", "").strip() or None

    return {
        "ffmpeg_ok": ffmpeg_ok,
        "funasr_import_ok": funasr_import_ok,
        "funasr_model_configured": funasr_model_configured,
        "funasr_model_explicit_from_env": funasr_model_explicit_from_env(),
        "funasr_default_model_cached": default_model_cached,
        "funasr_vad_model_cached": vad_model_cached,
        "funasr_required_models_cached": required_models_cached,
        "funasr_ready": runtime_ready,
        "ready_for_transcribe": ready_for_transcribe,
        "transcription_mode": transcription_mode,
        "funasr_model_id": model,
        "rushi_models_root": models_root,
    }

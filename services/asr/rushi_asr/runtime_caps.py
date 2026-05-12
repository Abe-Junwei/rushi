"""Runtime capabilities for /health (FunASR / ffmpeg) without loading models."""

from __future__ import annotations

import os

from rushi_asr import ffmpeg_audio
from rushi_asr.defaults import effective_funasr_model_id, funasr_model_explicit_from_env
from rushi_asr.model_prepare import default_model_cached_guess


def get_runtime_caps() -> dict[str, object]:
    """Lightweight introspection for desktop auto-detect (no FunASR model load)."""
    ffmpeg_ok = ffmpeg_audio.ffmpeg_available()
    funasr_import_ok = False
    try:
        import funasr  # noqa: F401, PLC0415 — optional heavy dep

        funasr_import_ok = True
    except ImportError:
        pass

    model = effective_funasr_model_id()
    funasr_model_configured = bool(model)
    # With a built-in default model id, readiness is gated by ffmpeg + optional import.
    funasr_ready = bool(ffmpeg_ok and funasr_import_ok)
    transcription_mode: str = "funasr" if funasr_ready else "stub"
    models_root = os.environ.get("RUSHI_MODELS_ROOT", "").strip() or None

    return {
        "ffmpeg_ok": ffmpeg_ok,
        "funasr_import_ok": funasr_import_ok,
        "funasr_model_configured": funasr_model_configured,
        "funasr_model_explicit_from_env": funasr_model_explicit_from_env(),
        "funasr_default_model_cached": default_model_cached_guess(),
        "funasr_ready": funasr_ready,
        "transcription_mode": transcription_mode,
        "funasr_model_id": model,
        "rushi_models_root": models_root,
    }

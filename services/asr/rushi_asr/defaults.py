"""Product defaults (single SKU; see docs/architecture/asr-sidecar-funasr-policy.md)."""

from __future__ import annotations

import os

# ModelScope hub id used when RUSHI_FUNASR_MODEL is unset (runtime download into RUSHI_MODELS_ROOT).
DEFAULT_FUNASR_MODEL_ID = "iic/SenseVoiceSmall"


def effective_funasr_model_id() -> str:
    v = os.environ.get("RUSHI_FUNASR_MODEL", "").strip()
    return v or DEFAULT_FUNASR_MODEL_ID


def funasr_model_explicit_from_env() -> bool:
    return bool(os.environ.get("RUSHI_FUNASR_MODEL", "").strip())

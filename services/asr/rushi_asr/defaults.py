"""Product defaults (single SKU; see docs/architecture/asr-sidecar-funasr-policy.md)."""

from __future__ import annotations

import os

# ModelScope hub id used when RUSHI_FUNASR_MODEL is unset (runtime download into RUSHI_MODELS_ROOT).
DEFAULT_FUNASR_MODEL_ID = (
    "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
)
DEFAULT_FUNASR_VAD_MODEL_ID = "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"
DEFAULT_FUNASR_PUNC_MODEL_ID = "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch"


def effective_funasr_model_id() -> str:
    v = os.environ.get("RUSHI_FUNASR_MODEL", "").strip()
    return v or DEFAULT_FUNASR_MODEL_ID


def effective_funasr_vad_model_id() -> str | None:
    v = os.environ.get("RUSHI_FUNASR_VAD_MODEL", "fsmn-vad").strip()
    if not v:
        return None
    if v == "fsmn-vad":
        return DEFAULT_FUNASR_VAD_MODEL_ID
    return v


def funasr_model_explicit_from_env() -> bool:
    return bool(os.environ.get("RUSHI_FUNASR_MODEL", "").strip())

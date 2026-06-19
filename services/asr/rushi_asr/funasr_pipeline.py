"""FunASR pipeline composition (recognizer + VAD + punc) for R3g-A Paraformer."""

from __future__ import annotations

import os

from rushi_asr.defaults import DEFAULT_FUNASR_PUNC_MODEL_ID


def is_funasr_nano_model(model_id: str) -> bool:
    return "fun-asr-nano" in (model_id or "").lower()


def recognizer_needs_punc_pipeline(model_id: str) -> bool:
    """Paraformer long-audio SKUs need ct-punc + sentence_timestamp for multi-segment output."""
    mid = (model_id or "").lower()
    if "sensevoice" in mid or "fun-asr-nano" in mid:
        return False
    if "paraformer" in mid or "vad-punc" in mid or "vad_punc" in mid:
        return True
    return False


def effective_funasr_punc_model_id(recognizer_model_id: str) -> str | None:
    if not recognizer_needs_punc_pipeline(recognizer_model_id):
        return None
    raw = os.environ.get("RUSHI_FUNASR_PUNC_MODEL", "ct-punc").strip()
    if not raw:
        return None
    if raw == "ct-punc":
        return DEFAULT_FUNASR_PUNC_MODEL_ID
    return raw

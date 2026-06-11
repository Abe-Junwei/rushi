"""FunASR generate() profiles per SKU (R3g-C). Preset-first; env overrides for ops only."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Literal

from rushi_asr.defaults import effective_funasr_forced_aligner_id
from rushi_asr.funasr_pipeline import recognizer_needs_punc_pipeline

# Kept in sync with rushi_asr.segmentation.LONG_AUDIO_SEC
LONG_AUDIO_SEC = 180.0

SkuFamily = Literal["paraformer", "sensevoice", "qwen", "generic"]

# FunASR Qwen3-ASR expects full language names (not zh/en codes).
_QWEN_FUNASR_LANGUAGE: dict[str, str] = {
    "zh": "Chinese",
    "en": "English",
    "yue": "Cantonese",
    "ja": "Japanese",
    "ko": "Korean",
    "auto": "Chinese",
}


def is_qwen_asr_model(model_id: str) -> bool:
    return "qwen" in (model_id or "").lower()


def funasr_language_for_model(model_id: str, language: str) -> str:
    """Map Rushi short codes to FunASR Qwen3-ASR language labels."""
    if not is_qwen_asr_model(model_id):
        return language
    return _QWEN_FUNASR_LANGUAGE.get(language, language)


@dataclass(frozen=True)
class AsrModelProfile:
    """Stable profile id for tests/docs; ``model_id`` remains the FunASR hub id."""

    profile_id: str
    sku_family: SkuFamily


def resolve_asr_model_profile(model_id: str) -> AsrModelProfile:
    mid = (model_id or "").lower()
    if "sensevoice" in mid:
        return AsrModelProfile(profile_id="sensevoice_small_v1", sku_family="sensevoice")
    if is_qwen_asr_model(model_id):
        return AsrModelProfile(profile_id="qwen3_asr_0_6b_v1", sku_family="qwen")
    if recognizer_needs_punc_pipeline(model_id):
        return AsrModelProfile(profile_id="paraformer_vad_punc_v1", sku_family="paraformer")
    return AsrModelProfile(profile_id="generic_funasr_v1", sku_family="generic")


def _env_use_itn_override() -> bool | None:
    raw = os.environ.get("RUSHI_FUNASR_USE_ITN", "").strip().lower()
    if not raw:
        return None
    if raw in ("0", "false", "no", "off"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    return None


def sensevoice_use_itn_default() -> bool:
    """Product default (Q-ACC-7); override via ``RUSHI_FUNASR_USE_ITN``."""
    override = _env_use_itn_override()
    if override is not None:
        return override
    return True


def build_generate_kwargs(
    model_id: str,
    language: str,
    hotwords: str | None,
    duration_sec: float | None = None,
) -> dict[str, Any]:
    """Build FunASR ``generate()`` kwargs from SKU profile + duration."""
    profile = resolve_asr_model_profile(model_id)
    kwargs: dict[str, Any] = {"language": funasr_language_for_model(model_id, language)}
    long_audio = duration_sec is not None and duration_sec >= LONG_AUDIO_SEC

    if profile.sku_family == "paraformer":
        kwargs["sentence_timestamp"] = True
        kwargs["merge_vad"] = False
        if long_audio:
            kwargs["batch_size_s"] = 60
            kwargs["batch_size_threshold_s"] = 30
    elif profile.sku_family == "sensevoice":
        kwargs["merge_vad"] = not long_audio
        if long_audio:
            kwargs["batch_size_s"] = 60
            kwargs["batch_size_threshold_s"] = 30
        if sensevoice_use_itn_default():
            kwargs["use_itn"] = True
            kwargs["rich_transcription_postprocess"] = True
    elif profile.sku_family == "qwen":
        kwargs["merge_vad"] = not long_audio
        if long_audio:
            kwargs["batch_size_s"] = 60
            kwargs["batch_size_threshold_s"] = 30
        if effective_funasr_forced_aligner_id():
            kwargs["return_time_stamps"] = True
    else:
        kwargs["merge_vad"] = not long_audio
        if long_audio:
            kwargs["batch_size_s"] = 60
            kwargs["batch_size_threshold_s"] = 30

    if hotwords:
        kwargs["hotword"] = hotwords
    return kwargs

"""Optional FunASR / SenseVoice path (install `pip install -e ".[funasr]"` and set RUSHI_FUNASR_MODEL).

Model id examples: `iic/SenseVoiceSmall`, `paraformer-zh` (see FunASR docs).
"""

from __future__ import annotations

import threading
from typing import Any

from rushi_asr.defaults import (
    effective_funasr_forced_aligner_id,
    effective_funasr_model_id,
    effective_funasr_vad_model_id,
)
from rushi_asr.model_cache_env import configure_hub_env
from rushi_asr.model_prepare import required_models_cached_guess
from rushi_asr.segmentation import funasr_generate_kwargs

_model_singleton: Any = None
_model_loaded_id: str | None = None
_model_loaded_forced_aligner: str | None = None
_runtime_lock = threading.RLock()
_ALLOWED_FUNASR_LANG = frozenset({"zh", "en", "ja", "ko", "yue", "auto"})

from rushi_asr.funasr_engine_infer import generate_and_parse_funasr, transcribe_with_funasr
from rushi_asr.funasr_engine_load import (
    _get_model,
    effective_funasr_language,
    invalidate_funasr_model_cache,
    loaded_funasr_model_id,
    runtime_lock,
    warmup_funasr_model,
)

__all__ = [
    "configure_hub_env",
    "effective_funasr_forced_aligner_id",
    "effective_funasr_language",
    "effective_funasr_model_id",
    "effective_funasr_vad_model_id",
    "funasr_generate_kwargs",
    "generate_and_parse_funasr",
    "invalidate_funasr_model_cache",
    "loaded_funasr_model_id",
    "required_models_cached_guess",
    "runtime_lock",
    "transcribe_with_funasr",
    "warmup_funasr_model",
    "_get_model",
    "_model_loaded_forced_aligner",
    "_model_loaded_id",
    "_model_singleton",
    "_runtime_lock",
]

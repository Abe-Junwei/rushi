"""Map RUSHI_MODELS_ROOT to upstream hub caches (ModelScope, Hugging Face)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)


def apply_models_root_env() -> None:
    """
    When RUSHI_MODELS_ROOT is set (e.g. by the desktop shell for the bundled sidecar),
    pin ModelScope / HF caches under that directory so weights live next to app data.
    Safe to call multiple times; only uses setdefault for cache vars.
    """
    raw = os.environ.get("RUSHI_MODELS_ROOT", "").strip()
    if not raw:
        return
    root = Path(raw)
    try:
        root.mkdir(parents=True, exist_ok=True)
    except OSError:
        return
    ms = root / "modelscope"
    hf = root / "huggingface"
    try:
        ms.mkdir(parents=True, exist_ok=True)
        hf.mkdir(parents=True, exist_ok=True)
    except OSError:
        return
    os.environ.setdefault("MODELSCOPE_CACHE", str(ms))
    os.environ.setdefault("HF_HOME", str(hf))

    endpoint = os.getenv("RUSHI_HF_ENDPOINT", "").strip()
    if endpoint:
        os.environ.setdefault("HF_ENDPOINT", endpoint)


def configure_hub_env() -> None:
    """Apply cache dirs + offline HF when required weights are already on disk."""
    apply_models_root_env()
    try:
        from rushi_asr.defaults import effective_funasr_model_id
        from rushi_asr.model_prepare import required_models_cached_guess

        model_id = effective_funasr_model_id()
        if model_id and required_models_cached_guess(model_id):
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
            log.debug("hub env: offline mode (required models cached for %s)", model_id)
    except Exception:  # noqa: BLE001 — startup must not fail on optional probe
        log.debug("hub env: skipped offline probe", exc_info=True)

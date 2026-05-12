"""Map RUSHI_MODELS_ROOT to upstream hub caches (ModelScope, Hugging Face)."""

from __future__ import annotations

import os
from pathlib import Path


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

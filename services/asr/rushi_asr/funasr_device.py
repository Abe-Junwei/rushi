"""Resolve FunASR ``AutoModel(device=…)`` per product GPU policy.

Policy: explicit ``RUSHI_FUNASR_DEVICE`` wins; otherwise prefer CUDA, then MPS, else CPU.
See ``docs/architecture/asr-sidecar-funasr-policy.md`` §3 and
``docs/execution/specs/local-asr-gpu-and-windowing-research.md``.
"""

from __future__ import annotations

import logging
import os
import platform
import sys
from pathlib import Path
from typing import Literal

log = logging.getLogger(__name__)

DeviceSource = Literal["env", "auto"]


def _frozen_sidecar_device() -> str | None:
    """Resolve the known PyInstaller variant without a cold torch import."""
    if not getattr(sys, "frozen", False):
        return None
    if sys.platform == "darwin":
        return "mps" if platform.machine() == "arm64" else "cpu"
    if sys.platform == "win32":
        return "cuda" if "cuda" in Path(sys.executable).stem.lower() else "cpu"
    return "cpu"


def _probe_auto_device() -> str:
    try:
        import torch
    except ImportError:
        return "cpu"
    try:
        if torch.cuda.is_available():
            return "cuda"
    except Exception:  # noqa: BLE001 — probe must never break load
        log.debug("funasr_device: cuda probe failed", exc_info=True)
    try:
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except Exception:  # noqa: BLE001
        log.debug("funasr_device: mps probe failed", exc_info=True)
    return "cpu"


def resolve_funasr_device() -> tuple[str, DeviceSource]:
    """Return ``(device, source)`` for AutoModel and ``/health``.

    - Non-empty ``RUSHI_FUNASR_DEVICE`` → use as-is (``source=env``), including ``cpu`` force.
    - Unset / blank → auto ``cuda`` → ``mps`` → ``cpu`` (``source=auto``).
    """
    raw = os.environ.get("RUSHI_FUNASR_DEVICE", "").strip()
    if raw:
        return raw, "env"
    return _probe_auto_device(), "auto"


def funasr_device_health_fields() -> dict[str, str]:
    raw = os.environ.get("RUSHI_FUNASR_DEVICE", "").strip()
    if raw:
        device, source = raw, "env"
    else:
        device = _frozen_sidecar_device() or _probe_auto_device()
        source = "auto"
    return {
        "funasr_device": device,
        "funasr_device_source": source,
    }

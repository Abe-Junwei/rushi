"""FunASR model load, cache, and warmup."""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Any

from rushi_asr.funasr_load_plan import build_funasr_load_plan
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id, is_funasr_nano_model
from rushi_asr.model_prepare_cache import (
    DEFAULT_PUNC_REQUIRED_FILES,
    DEFAULT_VAD_REQUIRED_FILES,
    funasr_qwen_hub_id,
    resolve_funasr_automodel_arg,
    resolve_qwen_forced_aligner_arg,
)

log = logging.getLogger(__name__)


def _engine():
    import rushi_asr.funasr_engine as engine

    return engine


def runtime_lock() -> threading.RLock:
    """Shared lock for model prepare, load, and inference."""
    return _engine()._runtime_lock


def loaded_funasr_model_id() -> str | None:
    """Hub id of the AutoModel currently resident in memory (None if unloaded)."""
    engine = _engine()
    with engine._runtime_lock:
        return engine._model_loaded_id


def invalidate_funasr_model_cache() -> None:
    """Drop loaded AutoModel so the next transcribe picks up new weights (e.g. after prepare)."""
    import gc

    engine = _engine()
    with engine._runtime_lock:
        engine._model_singleton = None
        engine._model_loaded_id = None
        engine._model_loaded_forced_aligner = None
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass


def effective_funasr_language() -> str:
    engine = _engine()
    raw = os.environ.get("RUSHI_FUNASR_LANGUAGE", "zh").strip() or "zh"
    return raw if raw in engine._ALLOWED_FUNASR_LANG else "zh"


def _funasr_hub_extra_kwargs(hub_id: str, resolved_arg: str) -> dict[str, Any]:
    """Qwen hub ids load via ModelScope (hub=ms), not HuggingFace."""
    if funasr_qwen_hub_id(hub_id) and resolved_arg == hub_id:
        return {"hub": "ms"}
    if is_funasr_nano_model(hub_id) and resolved_arg == hub_id:
        return {"hub": "ms"}
    if resolved_arg != hub_id:
        return {}
    if "qwen" in hub_id.lower():
        return {"hub": "ms"}
    return {}


def _ensure_funasr_nano_registered() -> None:
    try:
        from funasr.models.fun_asr_nano.model import FunASRNano
        from funasr.register import tables

        if "FunASRNano" not in tables.model_classes:
            tables.model_classes["FunASRNano"] = FunASRNano
    except ImportError:
        pass


def warmup_funasr_model() -> dict[str, Any]:
    """Load AutoModel into memory (separate from prepare download)."""
    engine = _engine()
    engine.configure_hub_env()
    model_id = engine.effective_funasr_model_id()
    if not model_id:
        raise RuntimeError("funasr_model_not_configured")
    if not engine.required_models_cached_guess(model_id):
        raise RuntimeError("funasr_models_not_ready")
    engine._get_model(model_id)
    plan = build_funasr_load_plan(model_id)
    return {
        "status": "ok",
        "funasr_model_id": model_id,
        "funasr_loaded_model_id": engine.loaded_funasr_model_id(),
        "funasr_forced_aligner_model_id": engine.effective_funasr_forced_aligner_id(),
        "load_plan": plan,
    }


def _get_model(model_id: str) -> Any:
    engine = _engine()
    forced_aligner = engine.effective_funasr_forced_aligner_id()
    with engine._runtime_lock:
        if (
            engine._model_singleton is not None
            and engine._model_loaded_id == model_id
            and engine._model_loaded_forced_aligner == forced_aligner
        ):
            return engine._model_singleton
        engine._model_singleton = None
        engine._model_loaded_id = None
        engine._model_loaded_forced_aligner = None
        try:
            from funasr import AutoModel
        except ImportError as e:
            raise RuntimeError("funasr_not_installed") from e

        engine.configure_hub_env()

        device = os.getenv("RUSHI_FUNASR_DEVICE", "cpu")
        model_arg = resolve_funasr_automodel_arg(model_id)
        kwargs: dict[str, Any] = {
            "model": model_arg,
            "trust_remote_code": True,
            "device": device,
            **_funasr_hub_extra_kwargs(model_id, model_arg),
        }
        vad = engine.effective_funasr_vad_model_id()
        if vad:
            vad_arg = resolve_funasr_automodel_arg(
                vad,
                required_files=DEFAULT_VAD_REQUIRED_FILES,
                min_weight_bytes=1 * 1024 * 1024,
            )
            kwargs["vad_model"] = vad_arg
            kwargs.update(_funasr_hub_extra_kwargs(vad, vad_arg))
            kwargs["vad_kwargs"] = {
                "max_single_segment_time": int(os.environ.get("RUSHI_FUNASR_VAD_MAX_MS", "30000")),
            }
        punc = effective_funasr_punc_model_id(model_id)
        if punc:
            punc_arg = resolve_funasr_automodel_arg(
                punc,
                required_files=DEFAULT_PUNC_REQUIRED_FILES,
                min_weight_bytes=1 * 1024 * 1024,
            )
            kwargs["punc_model"] = punc_arg
            kwargs.update(_funasr_hub_extra_kwargs(punc, punc_arg))
        if forced_aligner:
            aligner_arg = resolve_qwen_forced_aligner_arg(forced_aligner)
            kwargs["forced_aligner"] = aligner_arg
        if is_funasr_nano_model(model_id):
            local_dir = Path(model_arg)
            if local_dir.is_dir():
                from rushi_asr.funasr_nano_remote_code import funasr_nano_remote_code_ready

                if funasr_nano_remote_code_ready(local_dir):
                    kwargs["remote_code"] = str(local_dir / "model.py")
                else:
                    _ensure_funasr_nano_registered()
            else:
                _ensure_funasr_nano_registered()

        log.info(
            "loading FunASR model %s device=%s vad=%s punc=%s forced_aligner=%s",
            model_arg,
            device,
            kwargs.get("vad_model") or "-",
            kwargs.get("punc_model") or "-",
            kwargs.get("forced_aligner") or "-",
        )
        engine._model_singleton = AutoModel(**kwargs)
        engine._model_loaded_id = model_id
        engine._model_loaded_forced_aligner = forced_aligner
        return engine._model_singleton

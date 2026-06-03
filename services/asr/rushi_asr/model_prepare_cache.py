"""Model cache presence checks for FunASR hub artifacts."""

from __future__ import annotations

import os
from pathlib import Path

from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID, effective_funasr_model_id, effective_funasr_vad_model_id
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id

DEFAULT_MODEL_REQUIRED_FILES = ("model.pt", "config.yaml", "tokens.json")
DEFAULT_VAD_REQUIRED_FILES = ("model.pt",)
DEFAULT_PUNC_REQUIRED_FILES = ("model.pt", "config.yaml")

# Paraformer-style hub ids use model.pt; Qwen3-ASR uses HuggingFace-style layout.
QWEN_RECOGNIZER_REQUIRED_FILES = ("config.json", "model.safetensors")
QWEN_RECOGNIZER_WEIGHT_FILE = "model.safetensors"
RECOGNIZER_MIN_WEIGHT_BYTES = 100 * 1024 * 1024


def recognizer_cache_spec(model_id: str) -> tuple[tuple[str, ...], str, int]:
    """Required artifact names, primary weight filename, and minimum weight size."""
    mid = (model_id or "").lower()
    if "qwen" in mid:
        return (QWEN_RECOGNIZER_REQUIRED_FILES, QWEN_RECOGNIZER_WEIGHT_FILE, RECOGNIZER_MIN_WEIGHT_BYTES)
    return (DEFAULT_MODEL_REQUIRED_FILES, "model.pt", RECOGNIZER_MIN_WEIGHT_BYTES)


def disk_check_path() -> Path:
    raw = os.environ.get("RUSHI_MODELS_ROOT", "").strip()
    p = Path(raw) if raw else Path.home()
    try:
        p.mkdir(parents=True, exist_ok=True)
    except OSError:
        return Path.home()
    return p


def model_dir_candidates(root: Path, model_id: str) -> list[Path]:
    parts = model_id.split("/", 1)
    if len(parts) != 2:
        return []
    owner, name = parts
    candidates = [
        root / "models" / owner / name,
        root / "hub" / "models" / owner / name,
        root / "hub" / owner / name,
    ]

    unique: list[Path] = []
    for p in candidates:
        if p not in unique:
            unique.append(p)
    return unique


def looks_like_complete_model_dir(
    model_dir: Path,
    required_files: tuple[str, ...],
    min_weight_bytes: int,
    *,
    weight_file: str = "model.pt",
) -> bool:
    try:
        if not model_dir.is_dir():
            return False
        for rel in required_files:
            p = model_dir / rel
            if not p.is_file():
                return False
        weight_path = model_dir / weight_file
        if not weight_path.is_file():
            return False
        return weight_path.stat().st_size > min_weight_bytes
    except OSError:
        return False


def model_cached_guess(
    model_id: str,
    required_files: tuple[str, ...],
    min_weight_bytes: int,
    *,
    weight_file: str = "model.pt",
) -> bool:
    ms = os.environ.get("MODELSCOPE_CACHE", "").strip()
    if not ms:
        return False
    root = Path(ms)
    if not root.is_dir():
        return False
    for model_dir in model_dir_candidates(root, model_id):
        if looks_like_complete_model_dir(
            model_dir,
            required_files,
            min_weight_bytes,
            weight_file=weight_file,
        ):
            return True
    return False


def recognizer_model_cached_guess(model_id: str | None = None) -> bool:
    resolved_model_id = (model_id or "").strip() or effective_funasr_model_id()
    if not resolved_model_id:
        return False
    required, weight_file, min_bytes = recognizer_cache_spec(resolved_model_id)
    return model_cached_guess(
        resolved_model_id,
        required,
        min_bytes,
        weight_file=weight_file,
    )


def default_model_cached_guess() -> bool:
    """True when the default recognizer model looks fully cached in its final directory."""
    return recognizer_model_cached_guess(DEFAULT_FUNASR_MODEL_ID)


def vad_model_cached_guess() -> bool:
    vad_id = effective_funasr_vad_model_id()
    if not vad_id:
        return True
    return model_cached_guess(vad_id, DEFAULT_VAD_REQUIRED_FILES, 1 * 1024 * 1024)


def punc_model_cached_guess(model_id: str | None = None) -> bool:
    resolved_model_id = (model_id or "").strip() or effective_funasr_model_id()
    punc_id = effective_funasr_punc_model_id(resolved_model_id)
    if not punc_id:
        return True
    return model_cached_guess(punc_id, DEFAULT_PUNC_REQUIRED_FILES, 1 * 1024 * 1024)


def required_models_cached_guess(model_id: str | None = None) -> bool:
    resolved = (model_id or "").strip() or effective_funasr_model_id()
    return (
        recognizer_model_cached_guess(resolved)
        and vad_model_cached_guess()
        and punc_model_cached_guess(resolved)
    )

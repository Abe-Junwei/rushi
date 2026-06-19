"""Model cache presence checks for FunASR hub artifacts."""

from __future__ import annotations

import os
from pathlib import Path

from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID, effective_funasr_model_id, effective_funasr_vad_model_id
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id, is_funasr_nano_model

DEFAULT_MODEL_REQUIRED_FILES = ("model.pt", "config.yaml", "tokens.json")
DEFAULT_VAD_REQUIRED_FILES = ("model.pt",)
DEFAULT_PUNC_REQUIRED_FILES = ("model.pt", "config.yaml")

RECOGNIZER_MIN_WEIGHT_BYTES = 100 * 1024 * 1024


def recognizer_cache_spec(model_id: str) -> tuple[tuple[str, ...], str, int]:
    """Required artifact names, primary weight filename, and minimum weight size."""
    if is_funasr_nano_model(model_id):
        return (("model.pt", "config.yaml"), "model.pt", RECOGNIZER_MIN_WEIGHT_BYTES)
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
    escaped = name.replace(".", "___")
    candidates = [
        root / "models" / owner / name,
        root / "models" / owner / escaped,
        root / "hub" / "models" / owner / name,
        root / "hub" / "models" / owner / escaped,
        root / "hub" / owner / name,
        root / "hub" / owner / escaped,
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
    return find_cached_model_dir(
        model_id,
        required_files,
        min_weight_bytes,
        weight_file=weight_file,
    ) is not None


def find_cached_model_dir(
    model_id: str,
    required_files: tuple[str, ...],
    min_weight_bytes: int,
    *,
    weight_file: str = "model.pt",
) -> Path | None:
    ms = os.environ.get("MODELSCOPE_CACHE", "").strip()
    if not ms:
        return None
    root = Path(ms)
    if not root.is_dir():
        return None
    for model_dir in model_dir_candidates(root, model_id):
        if looks_like_complete_model_dir(
            model_dir,
            required_files,
            min_weight_bytes,
            weight_file=weight_file,
        ):
            return model_dir
    return None


def resolve_cached_hub_arg(
    hub_id: str,
    *,
    required_files: tuple[str, ...] | None = None,
    min_weight_bytes: int | None = None,
    weight_file: str | None = None,
) -> str:
    """Local ModelScope directory for prepare / cache probes."""
    if not hub_id:
        return hub_id
    req = required_files
    weight = weight_file
    min_b = min_weight_bytes
    if req is None or weight is None or min_b is None:
        spec_req, spec_weight, spec_min = recognizer_cache_spec(hub_id)
        req = req or spec_req
        weight = weight or spec_weight
        min_b = min_b if min_b is not None else spec_min
    cached = find_cached_model_dir(hub_id, req, min_b, weight_file=weight)
    return str(cached) if cached is not None else hub_id


def resolve_funasr_automodel_arg(
    hub_id: str,
    *,
    required_files: tuple[str, ...] | None = None,
    min_weight_bytes: int | None = None,
    weight_file: str | None = None,
) -> str:
    """FunASR AutoModel `model=` arg, preferring local cached model paths."""
    if not hub_id:
        return hub_id
    return resolve_cached_hub_arg(
        hub_id,
        required_files=required_files,
        min_weight_bytes=min_weight_bytes,
        weight_file=weight_file,
    )


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

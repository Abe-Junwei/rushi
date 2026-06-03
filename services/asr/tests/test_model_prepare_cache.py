"""Recognizer cache completeness rules (Paraformer vs Qwen3)."""

from __future__ import annotations

from pathlib import Path

from rushi_asr.model_prepare_cache import (
    QWEN_RECOGNIZER_REQUIRED_FILES,
    looks_like_complete_model_dir,
    recognizer_cache_spec,
    recognizer_model_cached_guess,
)


def test_recognizer_cache_spec_qwen_uses_safetensors() -> None:
    req, weight, min_b = recognizer_cache_spec("Qwen/Qwen3-ASR-0.6B")
    assert req == QWEN_RECOGNIZER_REQUIRED_FILES
    assert weight == "model.safetensors"
    assert min_b == 100 * 1024 * 1024


def test_recognizer_cache_spec_paraformer_uses_model_pt() -> None:
    req, weight, _ = recognizer_cache_spec("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch")
    assert "model.pt" in req
    assert weight == "model.pt"


def test_looks_like_complete_qwen_dir(tmp_path: Path) -> None:
    d = tmp_path / "qwen"
    d.mkdir()
    (d / "config.json").write_text("{}", encoding="utf-8")
    weight = d / "model.safetensors"
    weight.write_bytes(b"x" * (101 * 1024 * 1024))
    assert looks_like_complete_model_dir(
        d,
        QWEN_RECOGNIZER_REQUIRED_FILES,
        100 * 1024 * 1024,
        weight_file="model.safetensors",
    )


def test_looks_like_complete_rejects_qwen_without_safetensors(tmp_path: Path) -> None:
    d = tmp_path / "qwen"
    d.mkdir()
    (d / "config.json").write_text("{}", encoding="utf-8")
    (d / "model.pt").write_bytes(b"x" * 200)
    assert not looks_like_complete_model_dir(
        d,
        QWEN_RECOGNIZER_REQUIRED_FILES,
        100,
        weight_file="model.safetensors",
    )


def test_recognizer_model_cached_guess_qwen_with_modelscope_layout(tmp_path: Path, monkeypatch) -> None:
    ms = tmp_path / "ms"
    model_dir = ms / "models" / "Qwen" / "Qwen3-ASR-0.6B"
    model_dir.mkdir(parents=True)
    (model_dir / "config.json").write_text("{}", encoding="utf-8")
    (model_dir / "model.safetensors").write_bytes(b"x" * (101 * 1024 * 1024))
    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    assert recognizer_model_cached_guess("Qwen/Qwen3-ASR-0.6B")

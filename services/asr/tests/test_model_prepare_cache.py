"""Recognizer cache completeness rules for supported FunASR profiles."""

from __future__ import annotations

from pathlib import Path

from rushi_asr.model_prepare_cache import (
    looks_like_complete_model_dir,
    recognizer_cache_spec,
    recognizer_model_cached_guess,
    resolve_cached_hub_arg,
    resolve_funasr_automodel_arg,
)


def test_recognizer_cache_spec_paraformer_uses_model_pt() -> None:
    req, weight, _ = recognizer_cache_spec("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch")
    assert "model.pt" in req
    assert weight == "model.pt"


def test_recognizer_cache_spec_nano_omits_tokens_json() -> None:
    req, weight, _ = recognizer_cache_spec("FunAudioLLM/Fun-ASR-Nano-2512")
    assert req == ("model.pt", "config.yaml")
    assert weight == "model.pt"
    assert "tokens.json" not in req


def test_looks_like_complete_paraformer_dir(tmp_path: Path) -> None:
    d = tmp_path / "paraformer"
    d.mkdir()
    (d / "config.yaml").write_text("ok", encoding="utf-8")
    (d / "tokens.json").write_text("{}", encoding="utf-8")
    weight = d / "model.pt"
    weight.write_bytes(b"x" * (101 * 1024 * 1024))
    assert looks_like_complete_model_dir(
        d,
        ("model.pt", "config.yaml", "tokens.json"),
        100 * 1024 * 1024,
    )


def test_looks_like_complete_rejects_missing_required_file(tmp_path: Path) -> None:
    d = tmp_path / "paraformer"
    d.mkdir()
    (d / "model.pt").write_bytes(b"x" * 200)
    assert not looks_like_complete_model_dir(
        d,
        ("model.pt", "config.yaml", "tokens.json"),
        100,
    )


def test_recognizer_model_cached_guess_paraformer_with_modelscope_layout(tmp_path: Path, monkeypatch) -> None:
    ms = tmp_path / "ms"
    model_id = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    model_dir = ms / "models" / "iic" / "speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    model_dir.mkdir(parents=True)
    (model_dir / "config.yaml").write_text("ok", encoding="utf-8")
    (model_dir / "tokens.json").write_text("{}", encoding="utf-8")
    (model_dir / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))
    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    assert recognizer_model_cached_guess(model_id)


def test_resolve_cached_hub_arg_prefers_modelscope_path(tmp_path: Path, monkeypatch) -> None:
    ms = tmp_path / "ms"
    model_dir = ms / "models" / "iic" / "speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    model_dir.mkdir(parents=True)
    (model_dir / "config.yaml").write_text("ok", encoding="utf-8")
    (model_dir / "tokens.json").write_text("{}", encoding="utf-8")
    (model_dir / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))
    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    assert resolve_cached_hub_arg("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch") == str(model_dir)
    assert resolve_cached_hub_arg("iic/missing-hub") == "iic/missing-hub"


def test_resolve_funasr_automodel_arg_vad_prefers_local_path(tmp_path: Path, monkeypatch) -> None:
    from rushi_asr.model_prepare_cache import DEFAULT_VAD_REQUIRED_FILES

    ms = tmp_path / "ms"
    vad_dir = ms / "models" / "iic" / "speech_fsmn_vad_zh-cn-16k-common-pytorch"
    vad_dir.mkdir(parents=True)
    (vad_dir / "model.pt").write_bytes(b"x" * (2 * 1024 * 1024))
    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    hub = "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"
    assert (
        resolve_funasr_automodel_arg(
            hub,
            required_files=DEFAULT_VAD_REQUIRED_FILES,
            min_weight_bytes=1 * 1024 * 1024,
        )
        == str(vad_dir)
    )

"""Tests for FunASR load plan diagnostics."""

from __future__ import annotations

from pathlib import Path

from rushi_asr.funasr_load_plan import build_funasr_load_plan


def test_load_plan_uses_cached_model_paths_for_supported_models(tmp_path: Path, monkeypatch) -> None:
    ms = tmp_path / "ms"
    para = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    punc = "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch"
    para_dir = ms / "models" / "iic" / "speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    vad_dir = ms / "models" / "iic" / "speech_fsmn_vad_zh-cn-16k-common-pytorch"
    punc_dir = ms / "models" / "iic" / "punc_ct-transformer_zh-cn-common-vocab272727-pytorch"
    for d, include_tokens in ((para_dir, True), (vad_dir, False), (punc_dir, False)):
        d.mkdir(parents=True)
        (d / "config.yaml").write_text("ok", encoding="utf-8")
        if include_tokens:
            (d / "tokens.json").write_text("{}", encoding="utf-8")
        (d / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))

    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", para)

    plan = build_funasr_load_plan()
    assert plan["weights_cached_locally"] is True
    assert plan["uses_local_paths"] is True  # back-compat alias
    assert plan["model_arg"] == str(para_dir)
    assert plan["model_hub"] is None
    assert plan["vad_arg"] == str(vad_dir)
    assert plan["punc_model_id"] == punc
    assert plan["punc_arg"] == str(punc_dir)
    assert "forced_aligner_arg" not in plan

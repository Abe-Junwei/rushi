"""Tests for FunASR load plan diagnostics."""

from __future__ import annotations

from pathlib import Path

from rushi_asr.funasr_load_plan import build_funasr_load_plan


def test_load_plan_qwen_spike_uses_hub_ids_with_cached_weights(tmp_path: Path, monkeypatch) -> None:
    ms = tmp_path / "ms"
    qwen_dir = ms / "models" / "Qwen" / "Qwen3-ASR-0.6B"
    aligner_dir = ms / "models" / "Qwen" / "Qwen3-ForcedAligner-0.6B"
    vad_dir = ms / "models" / "iic" / "speech_fsmn_vad_zh-cn-16k-common-pytorch"
    for d, weight, extra in (
        (qwen_dir, "model.safetensors", "config.json"),
        (aligner_dir, "model.safetensors", "config.json"),
        (vad_dir, "model.pt", None),
    ):
        d.mkdir(parents=True)
        if extra:
            (d / extra).write_text("{}", encoding="utf-8")
        (d / weight).write_bytes(b"x" * (101 * 1024 * 1024))

    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", "Qwen/Qwen3-ASR-0.6B")
    monkeypatch.setenv("RUSHI_FUNASR_FORCED_ALIGNER", "Qwen/Qwen3-ForcedAligner-0.6B")

    plan = build_funasr_load_plan()
    assert plan["weights_cached_locally"] is True
    assert plan["uses_local_paths"] is True  # back-compat alias
    assert plan["model_arg"] == "Qwen/Qwen3-ASR-0.6B"
    assert plan["model_hub"] == "ms"
    assert plan["forced_aligner_arg"] == str(aligner_dir)
    assert plan["forced_aligner_hub"] == "ms"
    assert plan["vad_arg"] == str(vad_dir)

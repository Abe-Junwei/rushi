"""Hub cache env bootstrap (ModelScope / Hugging Face offline)."""

from __future__ import annotations

import os

from rushi_asr.model_cache_env import apply_models_root_env, configure_hub_env


def test_apply_models_root_env_sets_cache_dirs(tmp_path, monkeypatch) -> None:
    root = tmp_path / "models"
    monkeypatch.setenv("RUSHI_MODELS_ROOT", str(root))
    monkeypatch.delenv("MODELSCOPE_CACHE", raising=False)
    monkeypatch.delenv("HF_HOME", raising=False)
    apply_models_root_env()
    assert os.environ["MODELSCOPE_CACHE"] == str(root / "modelscope")
    assert os.environ["HF_HOME"] == str(root / "huggingface")


def test_configure_hub_env_offline_when_required_cached(
    tmp_path, monkeypatch,
) -> None:
    root = tmp_path / "models"
    ms = root / "modelscope"
    qwen = "Qwen/Qwen3-ASR-0.6B"
    aligner = "Qwen/Qwen3-ForcedAligner-0.6B"
    vad = "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"
    for hub_id, weight in (
        (qwen, "model.safetensors"),
        (aligner, "model.safetensors"),
        (vad, "model.pt"),
    ):
        owner, name = hub_id.split("/", 1)
        d = ms / "models" / owner / name
        d.mkdir(parents=True)
        if weight == "model.safetensors":
            (d / "config.json").write_text("{}", encoding="utf-8")
        else:
            (d / "config.yaml").write_text("ok", encoding="utf-8")
            (d / "tokens.json").write_text("{}", encoding="utf-8")
        (d / weight).write_bytes(b"x" * (101 * 1024 * 1024))

    monkeypatch.setenv("RUSHI_MODELS_ROOT", str(root))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", qwen)
    monkeypatch.setenv("RUSHI_FUNASR_FORCED_ALIGNER", aligner)
    monkeypatch.delenv("MODELSCOPE_CACHE", raising=False)
    monkeypatch.delenv("HF_HOME", raising=False)
    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    monkeypatch.delenv("TRANSFORMERS_OFFLINE", raising=False)

    configure_hub_env()
    assert os.environ.get("HF_HUB_OFFLINE") == "1"
    assert os.environ.get("TRANSFORMERS_OFFLINE") == "1"

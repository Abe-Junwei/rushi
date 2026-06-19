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
    para = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    vad = "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"
    punc = "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch"
    for hub_id, include_tokens in (
        (para, True),
        (vad, False),
        (punc, False),
    ):
        owner, name = hub_id.split("/", 1)
        d = ms / "models" / owner / name
        d.mkdir(parents=True)
        (d / "config.yaml").write_text("ok", encoding="utf-8")
        if include_tokens:
            (d / "tokens.json").write_text("{}", encoding="utf-8")
        (d / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))

    monkeypatch.setenv("RUSHI_MODELS_ROOT", str(root))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", para)
    monkeypatch.delenv("MODELSCOPE_CACHE", raising=False)
    monkeypatch.delenv("HF_HOME", raising=False)
    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    monkeypatch.delenv("TRANSFORMERS_OFFLINE", raising=False)

    configure_hub_env()
    assert os.environ.get("HF_HUB_OFFLINE") == "1"
    assert os.environ.get("TRANSFORMERS_OFFLINE") == "1"

from __future__ import annotations

from rushi_asr.model_catalog import (
    LOCAL_ASR_MODEL_CATALOG,
    catalog_entry_for_hub,
    get_catalog_status,
    is_known_hub_model_id,
    resolve_hub_model_id,
)


def test_catalog_has_r3g_a_models() -> None:
    ids = {e.catalog_id for e in LOCAL_ASR_MODEL_CATALOG}
    assert "sensevoice-small" in ids
    assert "paraformer-long-vad-punc" in ids
    assert len(LOCAL_ASR_MODEL_CATALOG) == 2


def test_resolve_hub_model_id_defaults() -> None:
    assert resolve_hub_model_id(None) == "iic/SenseVoiceSmall"
    assert resolve_hub_model_id("") == "iic/SenseVoiceSmall"
    para = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    assert resolve_hub_model_id(para) == para


def test_catalog_entry_for_hub() -> None:
    entry = catalog_entry_for_hub("iic/SenseVoiceSmall")
    assert entry is not None
    assert entry.catalog_id == "sensevoice-small"
    assert is_known_hub_model_id("iic/SenseVoiceSmall")


def test_get_catalog_status_marks_active(monkeypatch, tmp_path) -> None:
    ms = tmp_path / "modelscope"
    model_dir = ms / "models" / "iic" / "SenseVoiceSmall"
    model_dir.mkdir(parents=True)
    (model_dir / "config.yaml").write_text("ok")
    (model_dir / "tokens.json").write_text("{}")
    (model_dir / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))
    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", "iic/SenseVoiceSmall")

    items = get_catalog_status()
    assert len(items) == 2
    active = [i for i in items if i["active"]]
    assert len(active) == 1
    assert active[0]["catalog_id"] == "sensevoice-small"
    assert active[0]["cached"] is True

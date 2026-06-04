from __future__ import annotations

from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID
from rushi_asr.model_catalog import (
    LOCAL_ASR_MODEL_CATALOG,
    catalog_entry_for_hub,
    get_catalog_status,
    is_known_hub_model_id,
    migrate_deprecated_hub_model_id,
    resolve_hub_model_id,
)


def test_catalog_has_paraformer_only() -> None:
    ids = [e.catalog_id for e in LOCAL_ASR_MODEL_CATALOG]
    assert ids == ["paraformer-long-vad-punc"]
    assert "sensevoice-small" not in ids


def test_resolve_hub_model_id_defaults_to_paraformer() -> None:
    assert resolve_hub_model_id(None) == DEFAULT_FUNASR_MODEL_ID
    assert resolve_hub_model_id("") == DEFAULT_FUNASR_MODEL_ID


def test_migrate_deprecated_sensevoice() -> None:
    assert migrate_deprecated_hub_model_id("iic/SenseVoiceSmall") == DEFAULT_FUNASR_MODEL_ID
    assert resolve_hub_model_id("iic/SenseVoiceSmall") == DEFAULT_FUNASR_MODEL_ID


def test_catalog_entry_for_hub() -> None:
    entry = catalog_entry_for_hub(DEFAULT_FUNASR_MODEL_ID)
    assert entry is not None
    assert entry.catalog_id == "paraformer-long-vad-punc"
    assert is_known_hub_model_id(DEFAULT_FUNASR_MODEL_ID)
    assert not is_known_hub_model_id("iic/SenseVoiceSmall")


def test_get_catalog_status_active(tmp_path, monkeypatch) -> None:
    ms = tmp_path / "modelscope"
    model_dir = (
        ms
        / "models"
        / "iic"
        / "speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    )
    model_dir.mkdir(parents=True)
    (model_dir / "model.pt").write_bytes(b"x")
    monkeypatch.setenv("RUSHI_MODELS_ROOT", str(tmp_path))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", DEFAULT_FUNASR_MODEL_ID)
    active = get_catalog_status()
    assert len(active) == 1
    assert active[0]["catalog_id"] == "paraformer-long-vad-punc"
    assert active[0]["active"] is True

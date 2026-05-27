from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rushi_asr.app import create_app
from rushi_asr.model_prepare import (
    cancel_prepare_async,
    default_model_cached_guess,
    required_models_cached_guess,
    vad_model_cached_guess,
)
from rushi_asr.model_prepare_progress import (
    PrepareCancelledError,
    clear_prepare_cancel,
    raise_if_prepare_cancelled,
    request_prepare_cancel,
)


def test_prepare_cancel_when_idle() -> None:
    body = cancel_prepare_async()
    assert body.get("cancelled") is False
    assert body.get("reason") == "idle"


def test_prepare_cancel_raises_in_progress_callback() -> None:
    clear_prepare_cancel()
    request_prepare_cancel()
    with pytest.raises(PrepareCancelledError):
        raise_if_prepare_cancelled()


def test_prepare_cancel_endpoint() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.post("/v1/models/prepare-cancel")
    assert res.status_code == 200
    assert res.json().get("cancelled") is False


def test_root_documents_prepare_cancel() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert "prepare-cancel" in str(body.get("prepare_cancel", ""))


def test_prepare_status_idle() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/v1/models/prepare-status")
    assert res.status_code == 200
    body = res.json()
    assert body["phase"] in ("idle", "done", "error", "running")


def _skip_if_funasr_installed() -> None:
    try:
        import funasr  # noqa: F401, PLC0415
    except ImportError:
        return
    pytest.skip("venv includes funasr; use .[dev]-only venv for this assertion")


def test_prepare_default_without_funasr_returns_503() -> None:
    """Blocking prepare returns 503 when FunASR is not installed."""
    _skip_if_funasr_installed()
    app = create_app()
    client = TestClient(app)
    res = client.post("/v1/models/prepare-default")
    assert res.status_code == 503
    assert res.json().get("detail") == "funasr_not_installed"


def test_prepare_async_without_funasr_returns_503() -> None:
    """Async prepare returns 503 when FunASR is not installed."""
    _skip_if_funasr_installed()
    app = create_app()
    client = TestClient(app)
    res2 = client.post("/v1/models/prepare-default/async")
    assert res2.status_code == 503
    res3 = client.post("/v1/models/prepare/async", json={"model_id": "iic/SenseVoiceSmall"})
    assert res3.status_code == 503


def test_models_catalog_endpoint() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/v1/models/catalog")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body.get("items"), list)
    assert len(body["items"]) >= 2


def test_default_model_cached_guess_requires_complete_model(monkeypatch, tmp_path: Path) -> None:
    ms = tmp_path / "modelscope"
    model_dir = ms / "models" / "iic" / "SenseVoiceSmall"
    temp_dir = ms / "models" / "._____temp" / "iic" / "SenseVoiceSmall"
    vad_dir = ms / "models" / "iic" / "speech_fsmn_vad_zh-cn-16k-common-pytorch"

    temp_dir.mkdir(parents=True)
    (temp_dir / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))

    model_dir.mkdir(parents=True)
    (model_dir / "config.yaml").write_text("ok")
    (model_dir / "tokens.json").write_text("{}")

    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    assert default_model_cached_guess() is False
    assert vad_model_cached_guess() is False
    assert required_models_cached_guess() is False

    (model_dir / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))
    assert default_model_cached_guess() is True
    assert required_models_cached_guess() is False

    vad_dir.mkdir(parents=True)
    (vad_dir / "model.pt").write_bytes(b"x" * (2 * 1024 * 1024))
    assert vad_model_cached_guess() is True
    assert required_models_cached_guess() is True


def test_required_models_cached_guess_requires_punc_for_paraformer(monkeypatch, tmp_path: Path) -> None:
    ms = tmp_path / "modelscope"
    para = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    para_dir = ms / "models" / "iic" / "speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    vad_dir = ms / "models" / "iic" / "speech_fsmn_vad_zh-cn-16k-common-pytorch"
    punc_dir = ms / "models" / "iic" / "punc_ct-transformer_zh-cn-common-vocab272727-pytorch"

    for d, is_punc in ((para_dir, False), (vad_dir, False), (punc_dir, True)):
        d.mkdir(parents=True)
        (d / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))
        (d / "config.yaml").write_text("ok")
        if not is_punc:
            (d / "tokens.json").write_text("{}")

    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", para)

    assert required_models_cached_guess(para) is True

    (punc_dir / "model.pt").write_bytes(b"x")
    assert required_models_cached_guess(para) is False


def test_required_models_cached_guess_uses_explicit_model_env(monkeypatch, tmp_path: Path) -> None:
    ms = tmp_path / "modelscope"
    custom_dir = ms / "models" / "acme" / "custom-sensevoice"
    vad_dir = ms / "models" / "iic" / "speech_fsmn_vad_zh-cn-16k-common-pytorch"

    custom_dir.mkdir(parents=True)
    (custom_dir / "model.pt").write_bytes(b"x" * (101 * 1024 * 1024))
    (custom_dir / "config.yaml").write_text("ok")
    (custom_dir / "tokens.json").write_text("{}")

    vad_dir.mkdir(parents=True)
    (vad_dir / "model.pt").write_bytes(b"x" * (2 * 1024 * 1024))

    monkeypatch.setenv("MODELSCOPE_CACHE", str(ms))
    monkeypatch.setenv("RUSHI_FUNASR_MODEL", "acme/custom-sensevoice")

    assert default_model_cached_guess() is False
    assert vad_model_cached_guess() is True
    assert required_models_cached_guess() is True

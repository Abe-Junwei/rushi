from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rushi_asr.app import create_app
from rushi_asr.model_prepare import (
    default_model_cached_guess,
    required_models_cached_guess,
    vad_model_cached_guess,
)


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

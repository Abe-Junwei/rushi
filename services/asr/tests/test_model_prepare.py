from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rushi_asr.app import create_app
from rushi_asr.model_prepare import (
    cancel_prepare_async,
    default_model_cached_guess,
    required_models_cached_guess,
    reset_prepare_idle_state,
    vad_model_cached_guess,
)
from rushi_asr.model_prepare_progress import (
    PrepareCancelledError,
    clear_prepare_cancel,
    raise_if_prepare_cancelled,
    request_prepare_cancel,
)


@pytest.fixture(autouse=True)
def _isolate_prepare_state() -> None:
    reset_prepare_idle_state()
    clear_prepare_cancel()
    yield
    reset_prepare_idle_state()
    clear_prepare_cancel()


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


def test_warmup_endpoint_when_models_not_ready() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.post("/v1/models/warmup")
    if res.status_code == 503:
        assert res.json().get("detail") in (
            "funasr_not_installed",
            "funasr_models_not_ready",
            "funasr_model_not_configured",
        )
    else:
        assert res.status_code == 200
        assert res.json().get("status") == "ok"


def test_root_documents_warmup() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    assert "warmup" in str(res.json().get("warmup_model", ""))


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
    res3 = client.post(
        "/v1/models/prepare/async",
        json={
            "model_id": "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        },
    )
    assert res3.status_code == 503


def test_models_catalog_endpoint() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/v1/models/catalog")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body.get("items"), list)
    assert len(body["items"]) >= 1


def test_default_model_cached_guess_requires_complete_model(monkeypatch, tmp_path: Path) -> None:
    ms = tmp_path / "modelscope"
    para = "speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    model_dir = ms / "models" / "iic" / para
    temp_dir = ms / "models" / "._____temp" / "iic" / para
    vad_dir = ms / "models" / "iic" / "speech_fsmn_vad_zh-cn-16k-common-pytorch"
    punc_dir = ms / "models" / "iic" / "punc_ct-transformer_zh-cn-common-vocab272727-pytorch"

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
    assert required_models_cached_guess() is False

    punc_dir.mkdir(parents=True)
    (punc_dir / "model.pt").write_bytes(b"x" * (2 * 1024 * 1024))
    (punc_dir / "config.yaml").write_text("ok")
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


def test_cancelled_status_preserves_byte_progress(monkeypatch: pytest.MonkeyPatch) -> None:
    from rushi_asr import model_prepare_progress as mpp
    from rushi_asr.model_prepare_state import (
        finish_prepare_cancelled,
        prepare_status_body,
        try_begin_prepare_running,
    )

    monkeypatch.setattr(mpp, "_RECOGNIZER_BUDGET_BYTES", 1_000)
    monkeypatch.setattr(mpp, "_VAD_BUDGET_BYTES", 0)
    mpp.reset_prepare_download_progress(include_vad=False)
    # Drive the tracker directly so CI does not require modelscope ProgressCallback.
    mpp._tracker.register_file("model.pt", 1_000)
    mpp._tracker.add_bytes(430)

    began, token = try_begin_prepare_running()
    assert began is True
    finish_prepare_cancelled(run_token=token)

    body = prepare_status_body()
    assert body["phase"] == "cancelled"
    assert body["progress_percent"] == 43


def test_start_prepare_async_rejects_force_when_prior_run_stuck(monkeypatch: pytest.MonkeyPatch) -> None:
    from rushi_asr import model_prepare as mp
    from rushi_asr.model_prepare_state import try_begin_prepare_running

    began, _token = try_begin_prepare_running()
    assert began is True
    monkeypatch.setattr(mp, "_wait_prepare_not_running", lambda **kwargs: False)

    out = mp.start_prepare_async(None, force=True)
    assert out == {"started": False, "reason": "prepare_stuck"}

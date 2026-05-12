from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from rushi_asr.app import create_app


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

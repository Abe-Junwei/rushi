from __future__ import annotations

from fastapi.testclient import TestClient

from rushi_asr.app import create_app


def test_health_ok() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "rushi-asr"}

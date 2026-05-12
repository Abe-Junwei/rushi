from __future__ import annotations

from fastapi.testclient import TestClient

from rushi_asr.app import create_app


def test_root_ok() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["service"] == "rushi-asr"
    assert body["health"] == "/health"
    assert "prepare_model" in body
    assert "prepare_model_async" in body


def test_health_ok() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "rushi-asr"
    assert "ffmpeg_ok" in body
    assert "funasr_import_ok" in body
    assert "funasr_model_configured" in body
    assert "funasr_model_explicit_from_env" in body
    assert "funasr_ready" in body
    assert "rushi_models_root" in body
    assert "funasr_default_model_cached" in body
    assert body["transcription_mode"] in ("funasr", "stub")
    assert isinstance(body.get("funasr_model_id"), str)


def test_optional_local_token_blocks_mutating_endpoints(monkeypatch) -> None:
    monkeypatch.setenv("RUSHI_LOCAL_TOKEN", "secret")
    app = create_app()
    client = TestClient(app)

    prep = client.post("/v1/models/prepare-default/async")
    assert prep.status_code == 401
    assert prep.json().get("detail") == "invalid_local_token"

    transcribe = client.post(
        "/v1/transcribe",
        files={"file": ("x.wav", b"RIFF", "audio/wav")},
    )
    assert transcribe.status_code == 401
    assert transcribe.json().get("detail") == "invalid_local_token"


def test_optional_local_token_allows_when_header_matches(monkeypatch) -> None:
    monkeypatch.setenv("RUSHI_LOCAL_TOKEN", "secret")
    app = create_app()
    client = TestClient(app)

    prep = client.post(
        "/v1/models/prepare-default/async",
        headers={"x-rushi-local-token": "secret"},
    )
    # With valid token, request should pass token gate and enter normal endpoint path.
    assert prep.status_code != 401

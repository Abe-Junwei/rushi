from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from rushi_asr.app import create_app


def test_unload_endpoint_noop_when_not_loaded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "rushi_asr.transcribe_job.active_transcribe_job_count",
        lambda: 0,
    )
    monkeypatch.setattr(
        "rushi_asr.funasr_engine.effective_funasr_model_id",
        lambda: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    )
    invalidate_calls: list[int] = []

    def fake_invalidate() -> None:
        invalidate_calls.append(1)

    monkeypatch.setattr("rushi_asr.funasr_engine.invalidate_funasr_model_cache", fake_invalidate)

    app = create_app()
    client = TestClient(app)
    res = client.post("/v1/models/unload")
    assert res.status_code == 200
    body = res.json()
    assert body.get("status") == "ok"
    assert body.get("funasr_loaded_model_id") is None
    assert invalidate_calls == [1]


def test_unload_after_warmup_clears_loaded_id(monkeypatch: pytest.MonkeyPatch) -> None:
    loaded = {"id": "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"}

    def fake_loaded_id() -> str | None:
        return loaded["id"]

    def fake_invalidate() -> None:
        loaded["id"] = None

    monkeypatch.setattr("rushi_asr.transcribe_job.active_transcribe_job_count", lambda: 0)
    monkeypatch.setattr("rushi_asr.funasr_engine.loaded_funasr_model_id", fake_loaded_id)
    monkeypatch.setattr("rushi_asr.funasr_engine.invalidate_funasr_model_cache", fake_invalidate)
    monkeypatch.setattr(
        "rushi_asr.funasr_engine.effective_funasr_model_id",
        lambda: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    )

    app = create_app()
    client = TestClient(app)
    res = client.post("/v1/models/unload")
    assert res.status_code == 200
    assert loaded["id"] is None
    assert res.json().get("funasr_loaded_model_id") is None


def test_unload_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[int] = []
    monkeypatch.setattr("rushi_asr.transcribe_job.active_transcribe_job_count", lambda: 0)
    monkeypatch.setattr(
        "rushi_asr.funasr_engine.effective_funasr_model_id",
        lambda: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    )
    monkeypatch.setattr(
        "rushi_asr.funasr_engine.invalidate_funasr_model_cache",
        lambda: calls.append(1),
    )

    app = create_app()
    client = TestClient(app)
    for _ in range(2):
        res = client.post("/v1/models/unload")
        assert res.status_code == 200
    assert len(calls) == 2


def test_unload_rejects_when_transcribe_busy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("rushi_asr.transcribe_job.active_transcribe_job_count", lambda: 1)
    invalidate_calls: list[int] = []
    monkeypatch.setattr(
        "rushi_asr.funasr_engine.invalidate_funasr_model_cache",
        lambda: invalidate_calls.append(1),
    )

    app = create_app()
    client = TestClient(app)
    res = client.post("/v1/models/unload")
    assert res.status_code == 409
    assert res.json().get("detail") == "model_unload_transcribe_busy"
    assert invalidate_calls == []


def test_root_documents_unload() -> None:
    app = create_app()
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    assert "unload" in str(res.json().get("unload_model", ""))

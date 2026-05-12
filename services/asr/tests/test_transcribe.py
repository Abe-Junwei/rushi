from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rushi_asr.app import create_app
from rushi_asr import ffmpeg_audio


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


@pytest.mark.skipif(not ffmpeg_audio.ffmpeg_available(), reason="ffmpeg not on PATH")
def test_transcribe_wav_returns_contract(client: TestClient, tmp_path: Path) -> None:
    wav = tmp_path / "tone.wav"
    subprocess.run(
        [
            shutil.which("ffmpeg") or "ffmpeg",
            "-hide_banner",
            "-nostdin",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=880:duration=0.25",
            "-y",
            str(wav),
        ],
        check=True,
        capture_output=True,
    )
    res = client.post(
        "/v1/transcribe",
        files={"file": ("tone.wav", wav.read_bytes(), "audio/wav")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["schema_version"] == "1"
    assert body["engine"] == "stub"
    assert isinstance(body["warnings"], list)
    assert body["segments"] == []
    assert any(
        isinstance(w, str) and w.startswith("stub_no_placeholder_segment") for w in body["warnings"]
    )


def test_transcribe_requires_multipart_file(client: TestClient) -> None:
    res = client.post("/v1/transcribe")
    assert res.status_code == 422


@pytest.mark.skipif(not ffmpeg_audio.ffmpeg_available(), reason="ffmpeg not on PATH")
def test_transcribe_optional_hotwords_stub_emits_warning(client: TestClient, tmp_path: Path) -> None:
    wav = tmp_path / "tone2.wav"
    subprocess.run(
        [
            shutil.which("ffmpeg") or "ffmpeg",
            "-hide_banner",
            "-nostdin",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=0.2",
            "-y",
            str(wav),
        ],
        check=True,
        capture_output=True,
    )
    res = client.post(
        "/v1/transcribe",
        files={"file": ("tone2.wav", wav.read_bytes(), "audio/wav")},
        data={"hotwords": "禅修 打坐"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["engine"] == "stub"
    assert "hotwords_ignored_stub" in body["warnings"]

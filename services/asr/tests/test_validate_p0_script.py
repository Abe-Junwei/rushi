from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

# services/asr/tests/ -> repo root is parents[3]
ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "validate_p0_transcription_result.py"


@pytest.mark.skipif(not SCRIPT.is_file(), reason="validate script missing")
def test_validate_accepts_stub_like_payload() -> None:
    payload = {
        "schema_version": "1",
        "segments": [
            {
                "start_sec": 0.0,
                "end_sec": 0.5,
                "text": "",
                "confidence": None,
                "low_confidence": True,
                "detail": "stub",
            },
        ],
        "full_text": "",
        "engine": "stub",
        "duration_sec": 0.5,
        "warnings": [],
    }
    p = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ROOT),
    )
    assert p.returncode == 0, p.stderr


@pytest.mark.skipif(not SCRIPT.is_file(), reason="validate script missing")
def test_validate_accepts_stub_empty_segments_with_warning() -> None:
    payload = {
        "schema_version": "1",
        "segments": [],
        "full_text": "",
        "engine": "stub",
        "duration_sec": 0.5,
        "warnings": ["stub_no_placeholder_segment: no placeholder"],
    }
    p = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ROOT),
    )
    assert p.returncode == 0, p.stderr


@pytest.mark.skipif(not SCRIPT.is_file(), reason="validate script missing")
def test_validate_rejects_empty_segments_for_non_stub() -> None:
    payload = {
        "schema_version": "1",
        "segments": [],
        "full_text": "",
        "engine": "funasr+iic/SenseVoiceSmall",
        "duration_sec": 0.5,
        "warnings": [],
    }
    p = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ROOT),
    )
    assert p.returncode != 0


@pytest.mark.skipif(not SCRIPT.is_file(), reason="validate script missing")
def test_validate_rejects_empty_segments_in_strict_mode() -> None:
    payload = {
        "schema_version": "1",
        "segments": [],
        "full_text": "",
        "engine": "stub",
        "duration_sec": 0.5,
        "warnings": ["stub_no_placeholder_segment: no placeholder"],
    }
    p = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ROOT),
        env={**os.environ, "P0_REQUIRE_NONEMPTY_TEXT": "1"},
    )
    assert p.returncode != 0


@pytest.mark.skipif(not SCRIPT.is_file(), reason="validate script missing")
def test_validate_rejects_missing_degradable_confidence() -> None:
    payload = {
        "schema_version": "1",
        "segments": [
            {
                "start_sec": 0.0,
                "end_sec": 0.5,
                "text": "x",
                "confidence": None,
                "low_confidence": False,
            },
        ],
        "full_text": "x",
        "engine": "x",
        "duration_sec": 0.5,
        "warnings": [],
    }
    p = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ROOT),
    )
    assert p.returncode != 0

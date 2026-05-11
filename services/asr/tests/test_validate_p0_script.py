from __future__ import annotations

import json
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

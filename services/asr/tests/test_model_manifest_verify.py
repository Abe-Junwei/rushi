from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from rushi_asr.model_manifest_verify import load_manifest, verify_manifest


def test_verify_manifest_ok(tmp_path: Path) -> None:
    d = tmp_path / "m"
    d.mkdir()
    (d / "a.txt").write_bytes(b"hello")
    h = hashlib.sha256(b"hello").hexdigest()
    man = tmp_path / "man.json"
    man.write_text(json.dumps({"files": [{"path": "a.txt", "sha256": h}]}), encoding="utf-8")
    verify_manifest(d, load_manifest(man))


def test_verify_manifest_bad_hash(tmp_path: Path) -> None:
    d = tmp_path / "m"
    d.mkdir()
    (d / "a.txt").write_bytes(b"hello")
    man = tmp_path / "man.json"
    man.write_text(
        json.dumps({"files": [{"path": "a.txt", "sha256": "0" * 64}]}),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="sha256_mismatch"):
        verify_manifest(d, load_manifest(man))

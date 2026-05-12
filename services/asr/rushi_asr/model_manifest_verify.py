"""Optional SHA256 verification for a downloaded model directory (JSON manifest on disk)."""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


def load_manifest(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("files"), list):
        raise ValueError("manifest_invalid_shape")
    return data


def verify_manifest(model_dir: Path, manifest: dict[str, Any]) -> None:
    """Raises ``FileNotFoundError`` / ``ValueError`` on mismatch."""
    files = manifest["files"]
    for entry in files:
        if not isinstance(entry, dict):
            raise ValueError("manifest_entry_invalid")
        rel = entry.get("path") or entry.get("rel")
        want = entry.get("sha256")
        if not isinstance(rel, str) or not isinstance(want, str):
            raise ValueError("manifest_entry_invalid")
        fp = (model_dir / rel).resolve()
        if not str(fp).startswith(str(model_dir.resolve())):
            raise ValueError("manifest_path_escape")
        if not fp.is_file():
            raise FileNotFoundError(f"missing:{rel}")
        h = hashlib.sha256()
        h.update(fp.read_bytes())
        got = h.hexdigest()
        if got.lower() != want.lower():
            raise ValueError(f"sha256_mismatch:{rel}")
    log.info("model_manifest_verify: ok (%d files)", len(files))

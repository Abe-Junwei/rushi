"""Sync Fun-ASR repo remote_code (model.py + ctc.py + tools/) into Nano weight directory."""

from __future__ import annotations

import json
import logging
import shutil
import urllib.request
from pathlib import Path

log = logging.getLogger(__name__)

_FUN_ASR_RAW = "https://raw.githubusercontent.com/FunAudioLLM/Fun-ASR/main"
_GITHUB_API = "https://api.github.com/repos/FunAudioLLM/Fun-ASR/contents"
_REMOTE_FILES = ("model.py", "ctc.py", "__init__.py")
_REMOTE_DIRS = ("tools",)


def funasr_nano_remote_code_ready(model_dir: Path) -> bool:
    if not model_dir.is_dir():
        return False
    if not (model_dir / "model.py").is_file():
        return False
    if not (model_dir / "ctc.py").is_file():
        return False
    return (model_dir / "tools").is_dir()


def _fetch_bytes(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read()


def _fetch_raw(path: str) -> bytes:
    return _fetch_bytes(f"{_FUN_ASR_RAW}/{path}")


def _sync_tree(rel_dir: str, dest_root: Path) -> None:
    listing = json.loads(_fetch_bytes(f"{_GITHUB_API}/{rel_dir}"))
    out_dir = dest_root / rel_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    for item in listing:
        name = item["name"]
        item_type = item["type"]
        rel_path = f"{rel_dir}/{name}"
        if item_type == "file":
            (out_dir / name).write_bytes(_fetch_raw(rel_path))
        elif item_type == "dir":
            _sync_tree(rel_path, dest_root)


def sync_funasr_nano_remote_code(model_dir: Path, *, force: bool = False) -> Path:
    """Download Fun-ASR remote_code bundle beside cached Nano weights."""
    model_dir.mkdir(parents=True, exist_ok=True)
    if not force and funasr_nano_remote_code_ready(model_dir):
        return model_dir / "model.py"

    log.info("syncing Fun-ASR remote_code into %s", model_dir)
    for name in _REMOTE_FILES:
        (model_dir / name).write_bytes(_fetch_raw(name))

    if (model_dir / "tools").exists():
        shutil.rmtree(model_dir / "tools")
    for rel_dir in _REMOTE_DIRS:
        _sync_tree(rel_dir, model_dir)

    if not funasr_nano_remote_code_ready(model_dir):
        raise RuntimeError("funasr_nano_remote_code_incomplete")
    return model_dir / "model.py"

"""Fetch and verify the pinned Fun-ASR Nano Python code bundle."""
from __future__ import annotations

import hashlib
import importlib.util
import sys
import json
import urllib.request
from pathlib import Path

_MANIFEST = json.loads(Path(__file__).with_name("funasr_nano_code_manifest.json").read_text())
_REVISION = _MANIFEST["revision"]
_FILES: dict[str, str] = _MANIFEST["files"]
_BASE = f"https://raw.githubusercontent.com/FunAudioLLM/Fun-ASR/{_REVISION}"


def funasr_nano_remote_code_ready(model_dir: Path) -> bool:
    """Existence alone must never authorize executable model code."""
    try:
        return all(
            not (model_dir / name).is_symlink()
            and hashlib.sha256((model_dir / name).read_bytes()).hexdigest() == digest
            for name, digest in _FILES.items()
        ) and set(p.relative_to(model_dir).as_posix() for p in (model_dir / "tools").rglob("*.py")) == {
            name for name in _FILES if name.startswith("tools/")
        }
    except OSError:
        return False


def load_funasr_nano_remote_code(model_dir: Path) -> None:
    """Import verified Python only; never enable FunASR's automatic pip/remote-code hook."""
    if not funasr_nano_remote_code_ready(model_dir):
        raise RuntimeError("funasr_nano_remote_code_unverified")
    name = f"rushi_funasr_nano_{_REVISION}"
    if name in sys.modules:
        return
    spec = importlib.util.spec_from_file_location(name, model_dir / "model.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("funasr_nano_code_import_failed")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    sys.path.insert(0, str(model_dir))
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    finally:
        sys.path.remove(str(model_dir))


def sync_funasr_nano_remote_code(model_dir: Path, *, force: bool = False) -> Path:
    """Validate all downloads before replacing any executable files."""
    if not force and funasr_nano_remote_code_ready(model_dir):
        return model_dir / "model.py"
    payloads = {}
    for name, digest in _FILES.items():
        with urllib.request.urlopen(f"{_BASE}/{name}", timeout=120) as response:
            content = response.read()
        if hashlib.sha256(content).hexdigest() != digest:
            raise RuntimeError(f"funasr_nano_code_sha256_mismatch:{name}")
        payloads[name] = content
    # Refuse an old or augmented tools tree rather than executing unlisted Python files.
    for path in (model_dir / "tools").rglob("*.py"):
        if path.relative_to(model_dir).as_posix() not in _FILES:
            raise RuntimeError("funasr_nano_code_unlisted_file")
    for name, content in payloads.items():
        dest = model_dir / name
        if dest.is_symlink() or any(p.is_symlink() for p in dest.parents if p != model_dir.parent):
            raise RuntimeError("funasr_nano_code_symlink")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
    if not funasr_nano_remote_code_ready(model_dir):
        raise RuntimeError("funasr_nano_remote_code_incomplete")
    return model_dir / "model.py"

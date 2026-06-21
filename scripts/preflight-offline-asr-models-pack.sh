#!/usr/bin/env bash
# Verify offline ASR model pack zip or staging directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASR_VENV="${ROOT}/services/asr/.venv/bin/python"
TARGET="${1:-${ROOT}/dist/offline-asr-models-pack/rushi-offline-asr-models_$(node -p "require('${ROOT}/apps/desktop/package.json').version").zip}"

echo "== preflight offline ASR models pack =="
echo "    target=${TARGET}"

if [[ ! -e "${TARGET}" ]]; then
  echo "FAIL: pack not found: ${TARGET}" >&2
  exit 1
fi

if [[ ! -x "${ASR_VENV}" ]]; then
  echo "FAIL: ASR venv missing" >&2
  exit 1
fi

RUSHI_REPO_ROOT="${ROOT}" TARGET="${TARGET}" "${ASR_VENV}" - <<'PY'
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(os.environ["RUSHI_REPO_ROOT"])
sys.path.insert(0, str(ROOT / "services" / "asr"))

from rushi_asr.defaults import (
    DEFAULT_FUNASR_MODEL_ID,
    DEFAULT_FUNASR_PUNC_MODEL_ID,
    DEFAULT_FUNASR_VAD_MODEL_ID,
)
from rushi_asr.model_prepare_cache import (
    find_cached_model_dir,
    recognizer_cache_spec,
)

target = Path(os.environ["TARGET"])
work = target
cleanup = None

def safe_extractall(zf: zipfile.ZipFile, dest: Path) -> None:
    dest_resolved = dest.resolve()
    for info in zf.infolist():
        out = (dest / info.filename).resolve()
        if dest_resolved not in out.parents and out != dest_resolved:
            raise SystemExit(f"FAIL: zip slip path {info.filename!r}")
        if info.is_dir():
            out.mkdir(parents=True, exist_ok=True)
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(info) as src, out.open("wb") as dst:
            dst.write(src.read())

if target.is_file() and target.suffix.lower() == ".zip":
    cleanup = Path(tempfile.mkdtemp(prefix="rushi-offline-pack-preflight-"))
    with zipfile.ZipFile(target) as zf:
        safe_extractall(zf, cleanup)
    work = cleanup

manifest_path = work / "manifest.json"
if not manifest_path.is_file():
    raise SystemExit(f"FAIL: missing manifest.json under {work}")

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("pack_version") != 1:
    raise SystemExit(f"FAIL: unexpected pack_version {manifest.get('pack_version')}")
if manifest.get("bundle_id") != "default-paraformer-v1":
    raise SystemExit(f"FAIL: unexpected bundle_id {manifest.get('bundle_id')}")

ms_root = work / "modelscope"
if not ms_root.is_dir():
    raise SystemExit("FAIL: missing modelscope/ in pack")

for hub_id in (
    DEFAULT_FUNASR_MODEL_ID,
    DEFAULT_FUNASR_VAD_MODEL_ID,
    DEFAULT_FUNASR_PUNC_MODEL_ID,
):
    if hub_id == DEFAULT_FUNASR_MODEL_ID:
        req, weight, min_b = recognizer_cache_spec(hub_id)
    elif hub_id == DEFAULT_FUNASR_VAD_MODEL_ID:
        req, weight, min_b = ("model.pt",), "model.pt", 1024 * 1024
    else:
        req, weight, min_b = ("model.pt", "config.yaml"), "model.pt", 1024 * 1024
    os.environ["MODELSCOPE_CACHE"] = str(ms_root)
    cached = find_cached_model_dir(hub_id, req, min_b, weight_file=weight)
    if cached is None:
        raise SystemExit(f"FAIL: incomplete model in pack: {hub_id}")
    print(f"  ok {hub_id} -> {cached}")

for name in ("NOTICE.txt", "LICENSE-APACHE-2.0.txt"):
    if not (work / name).is_file():
        raise SystemExit(f"FAIL: missing {name}")

if cleanup is not None:
    import shutil
    shutil.rmtree(cleanup, ignore_errors=True)

print("OK: offline ASR models pack preflight passed")
PY

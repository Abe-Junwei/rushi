#!/usr/bin/env bash
# Preflight bundled-asr-models directory before Tauri bundle (Plan B).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-${ROOT}/apps/desktop/src-tauri/resources/bundled-asr-models}"

if [[ ! -d "${TARGET}" ]]; then
  echo "FAIL: bundled-asr-models directory missing: ${TARGET}" >&2
  exit 1
fi

for required in manifest.json NOTICE.txt LICENSE-APACHE-2.0.txt modelscope; do
  if [[ ! -e "${TARGET}/${required}" ]]; then
    echo "FAIL: missing ${required} in ${TARGET}" >&2
    exit 1
  fi
done

ASR_VENV="$(bash "${ROOT}/scripts/resolve-asr-venv-python.sh" 2>/dev/null || true)"
if [[ -z "${ASR_VENV}" ]] || [[ ! -f "${ASR_VENV}" ]]; then
  echo "WARN: ASR venv missing; skipping weight size checks"
  exit 0
fi

RUSHI_REPO_ROOT="${ROOT}" TARGET="${TARGET}" "${ASR_VENV}" - <<'PY'
import json
import os
import sys
from pathlib import Path

ROOT = Path(os.environ["RUSHI_REPO_ROOT"])
target = Path(os.environ["TARGET"])
sys.path.insert(0, str(ROOT / "services" / "asr"))

from rushi_asr.defaults import (
    DEFAULT_FUNASR_MODEL_ID,
    DEFAULT_FUNASR_PUNC_MODEL_ID,
    DEFAULT_FUNASR_VAD_MODEL_ID,
)

manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
if manifest.get("bundle_id") != "default-paraformer-v1":
    raise SystemExit(f"FAIL: unexpected bundle_id {manifest.get('bundle_id')!r}")

ms = target / "modelscope"
for hub_id in (DEFAULT_FUNASR_MODEL_ID, DEFAULT_FUNASR_VAD_MODEL_ID, DEFAULT_FUNASR_PUNC_MODEL_ID):
    owner, name = hub_id.split("/", 1)
    candidates = [
        ms / "models" / owner / name,
        ms / "models" / owner / name.replace(".", "___"),
    ]
    if not any(p.is_dir() for p in candidates):
        raise SystemExit(f"FAIL: model dir missing for {hub_id}")
print("OK: bundled-asr-models preflight passed")
PY

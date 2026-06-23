#!/usr/bin/env bash
# Stage default Paraformer triplet into Tauri bundle resources (Plan B · v0.1.8).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"

VERSION="$(node -p "require('${ROOT}/apps/desktop/package.json').version")"
BUILD_CACHE="${ROOT}/dist/bundled-asr-models/.modelscope-cache"
STAGING="${ROOT}/dist/bundled-asr-models/staging"
DEST="${ROOT}/apps/desktop/src-tauri/resources/bundled-asr-models"

echo "== stage bundled ASR models (Plan B) =="
echo "    version=${VERSION}"
echo "    dest=${DEST}"

if ! ASR_VENV="$(bash "${ROOT}/scripts/resolve-asr-venv-python.sh" 2>/dev/null)"; then
  echo "==> bootstrapping services/asr/.venv"
  bash "${ROOT}/scripts/bootstrap-asr-venv.sh"
  ASR_VENV="$(bash "${ROOT}/scripts/resolve-asr-venv-python.sh")"
fi

export_asr_model_env
export MODELSCOPE_CACHE="${BUILD_CACHE}/modelscope"
export RUSHI_MODELS_ROOT="${BUILD_CACHE}"
mkdir -p "${MODELSCOPE_CACHE}" "${STAGING}"

echo "==> snapshot_download default Paraformer triplet"
RUSHI_REPO_ROOT="${ROOT}" "${ASR_VENV}" - <<'PY'
import os
import sys
from pathlib import Path

ROOT = Path(os.environ["RUSHI_REPO_ROOT"])
sys.path.insert(0, str(ROOT / "services" / "asr"))

from modelscope.hub.snapshot_download import snapshot_download
from rushi_asr.defaults import (
    DEFAULT_FUNASR_MODEL_ID,
    DEFAULT_FUNASR_PUNC_MODEL_ID,
    DEFAULT_FUNASR_VAD_MODEL_ID,
)

for model_id in (
    DEFAULT_FUNASR_MODEL_ID,
    DEFAULT_FUNASR_VAD_MODEL_ID,
    DEFAULT_FUNASR_PUNC_MODEL_ID,
):
    print(f"downloading {model_id} …", flush=True)
    snapshot_download(model_id)
print("OK: snapshot_download complete")
PY

rm -rf "${STAGING:?}"/*
mkdir -p "${STAGING}"

MANIFEST_TEMPLATE="${ROOT}/resources/bundled-asr-models-manifest.template.json"
if [[ ! -f "${MANIFEST_TEMPLATE}" ]]; then
  echo "FAIL: manifest template missing: ${MANIFEST_TEMPLATE}" >&2
  exit 1
fi

RUSHI_REPO_ROOT="${ROOT}" VERSION="${VERSION}" STAGING="${STAGING}" MANIFEST_TEMPLATE="${MANIFEST_TEMPLATE}" "${ASR_VENV}" - <<'PY'
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(os.environ["RUSHI_REPO_ROOT"])
sys.path.insert(0, str(ROOT / "services" / "asr"))

from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID
from rushi_asr.model_prepare_cache import required_models_cached_guess

if not required_models_cached_guess(DEFAULT_FUNASR_MODEL_ID):
    raise SystemExit("FAIL: recognizer not cached after download")

ms_cache = Path(os.environ["MODELSCOPE_CACHE"])
staging = Path(os.environ["STAGING"])
version = os.environ["VERSION"]
manifest_template = Path(os.environ["MANIFEST_TEMPLATE"])

dest_modelscope = staging / "modelscope"
if dest_modelscope.exists():
    shutil.rmtree(dest_modelscope)
shutil.copytree(ms_cache, dest_modelscope, dirs_exist_ok=True)

manifest = json.loads(manifest_template.read_text(encoding="utf-8"))
manifest["rushi_version"] = version
(staging / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

notice = """Rushi bundled ASR models (default Paraformer triplet)

Upstream: ModelScope / FunASR (Apache License 2.0 — see LICENSE-APACHE-2.0.txt)

Included model repositories:
- iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch
- iic/speech_fsmn_vad_zh-cn-16k-common-pytorch
- iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch
"""
(staging / "NOTICE.txt").write_text(notice, encoding="utf-8")
apache = ROOT / "docs" / "legal" / "apache-2.0.txt"
if apache.is_file():
    shutil.copy2(apache, staging / "LICENSE-APACHE-2.0.txt")
else:
    (staging / "LICENSE-APACHE-2.0.txt").write_text(
        "Apache License 2.0 — https://www.apache.org/licenses/LICENSE-2.0\n",
        encoding="utf-8",
    )
print(f"OK: staged at {staging}")
PY

rm -rf "${DEST}"
mkdir -p "$(dirname "${DEST}")"
cp -R "${STAGING}/." "${DEST}/"

echo "==> preflight staged tree"
bash "${ROOT}/scripts/preflight-bundled-asr-models.sh" "${DEST}"

du -sh "${DEST}"
echo "OK: bundled-asr-models ready at ${DEST}"

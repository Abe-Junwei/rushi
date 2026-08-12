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

# Fail closed even when the ASR venv is unavailable. Release media always uses
# the canonical models/{owner}/{name} layout and must contain every manifest
# file with a plausibly complete primary weight.
node - "${TARGET}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.argv[2]);
const manifest = JSON.parse(fs.readFileSync(path.join(target, "manifest.json"), "utf8"));
if (manifest.pack_version !== 1) {
  throw new Error(`unexpected pack_version ${JSON.stringify(manifest.pack_version)}`);
}
if (manifest.bundle_id !== "default-paraformer-v1") {
  throw new Error(`unexpected bundle_id ${JSON.stringify(manifest.bundle_id)}`);
}
if (!Array.isArray(manifest.models) || manifest.models.length === 0) {
  throw new Error("bundled model manifest contains no models");
}
for (const entry of manifest.models) {
  const [owner, name, ...extra] = String(entry.hub_id ?? "").split("/");
  const validSegment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
  if (!validSegment.test(owner) || !validSegment.test(name) || extra.length > 0) {
    throw new Error(`invalid bundled model id ${JSON.stringify(entry.hub_id)}`);
  }
  const modelDir = path.join(target, "modelscope", "models", owner, name);
  const required = Array.isArray(entry.required_files) ? entry.required_files : [];
  if (required.length === 0) {
    throw new Error(`bundled model has no required_files: ${entry.hub_id}`);
  }
  for (const relative of required) {
    const resolved = path.resolve(modelDir, String(relative));
    if (!resolved.startsWith(`${path.resolve(modelDir)}${path.sep}`)) {
      throw new Error(`invalid required path for ${entry.hub_id}: ${relative}`);
    }
    if (!fs.statSync(resolved, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`missing required file for ${entry.hub_id}: ${resolved}`);
    }
  }
  const weightRelative = required.find((relative) => /\.(pt|onnx)$/.test(relative)) ?? "model.pt";
  const weightPath = path.join(modelDir, weightRelative);
  const weightBytes = fs.statSync(weightPath).size;
  const minimumBytes = Number(entry.min_weight_bytes ?? 0);
  if (!Number.isSafeInteger(minimumBytes) || minimumBytes < 0) {
    throw new Error(`invalid min_weight_bytes for ${entry.hub_id}: ${entry.min_weight_bytes}`);
  }
  if (weightBytes <= minimumBytes) {
    throw new Error(
      `weight too small for ${entry.hub_id}: ${weightBytes} bytes (must exceed ${minimumBytes})`,
    );
  }
}
console.log("OK: canonical bundled model tree is complete");
NODE

ASR_VENV="$(bash "${ROOT}/scripts/resolve-asr-venv-python.sh" 2>/dev/null || true)"
if [[ -z "${ASR_VENV}" ]] || [[ ! -f "${ASR_VENV}" ]]; then
  echo "WARN: ASR venv missing; skipping sidecar cache compatibility check"
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

from rushi_asr.defaults import DEFAULT_FUNASR_MODEL_ID
from rushi_asr.model_prepare_cache import required_models_cached_guess

manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
if manifest.get("bundle_id") != "default-paraformer-v1":
    raise SystemExit(f"FAIL: unexpected bundle_id {manifest.get('bundle_id')!r}")

ms = target / "modelscope"
os.environ["MODELSCOPE_CACHE"] = str(ms)
if not required_models_cached_guess(DEFAULT_FUNASR_MODEL_ID):
    raise SystemExit(
        "FAIL: default Paraformer triplet incomplete under bundled modelscope cache "
        f"({ms})"
    )

print("OK: bundled-asr-models preflight passed")
PY

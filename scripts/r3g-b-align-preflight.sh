#!/usr/bin/env bash
# R3g-B-Align preflight — verify env, cache, sidecar /health load_plan before spike eval.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"

export RUSHI_FUNASR_MODEL="${RUSHI_FUNASR_MODEL:-Qwen/Qwen3-ASR-0.6B}"
export RUSHI_FUNASR_FORCED_ALIGNER="${RUSHI_FUNASR_FORCED_ALIGNER:-Qwen/Qwen3-ForcedAligner-0.6B}"
export_asr_model_env

BASE="${ASR_BASE_URL:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
VENV_PY="${ROOT}/services/asr/.venv/bin/python"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "== R3g-B-Align preflight =="
echo "RUSHI_FUNASR_MODEL=${RUSHI_FUNASR_MODEL}"
echo "RUSHI_FUNASR_FORCED_ALIGNER=${RUSHI_FUNASR_FORCED_ALIGNER}"
echo "RUSHI_MODELS_ROOT=${RUSHI_MODELS_ROOT}"

if [[ ! -x "${VENV_PY}" ]]; then
  fail "missing ${VENV_PY} — run: bash scripts/bootstrap-asr-venv.sh"
fi

"${VENV_PY}" - <<'PY' || fail "local cache / load_plan check"
import os
import sys
from rushi_asr.model_prepare import required_models_cached_guess
from rushi_asr.funasr_load_plan import build_funasr_load_plan

model = os.environ["RUSHI_FUNASR_MODEL"]
if not required_models_cached_guess(model):
    print("required_models_cached: false", file=sys.stderr)
    sys.exit(1)
plan = build_funasr_load_plan(model)
print("load_plan:", plan)
if not plan.get("weights_cached_locally"):
    print("weights_cached_locally: false (weights missing on disk)", file=sys.stderr)
    sys.exit(2)
# Qwen AutoModel must use hub ids + hub=ms, not filesystem paths.
if plan.get("model_arg") != model:
    print(f"model_arg={plan.get('model_arg')!r} expected hub id {model!r}", file=sys.stderr)
    sys.exit(3)
print("OK: spike weights cached; Qwen load plan uses hub ids")
PY

if ! curl -sf --max-time 3 "${BASE}/health" >/dev/null 2>&1; then
  fail "sidecar not reachable at ${BASE} — start: export RUSHI_FUNASR_FORCED_ALIGNER=... && npm run asr:dev"
fi

HEALTH="$(curl -sf "${BASE}/health")"
echo ""
echo "-- /health --"
echo "${HEALTH}" | python3 -m json.tool

export HEALTH_JSON="${HEALTH}"
python3 <<'PY' || fail "sidecar /health mismatch"
import json
import os
import sys

h = json.loads(os.environ["HEALTH_JSON"])
want_model = os.environ["RUSHI_FUNASR_MODEL"]
want_aligner = os.environ["RUSHI_FUNASR_FORCED_ALIGNER"]
if h.get("funasr_model_id") != want_model:
    print(f"funasr_model_id={h.get('funasr_model_id')!r} want {want_model!r}", file=sys.stderr)
    sys.exit(1)
if h.get("funasr_forced_aligner_model_id") != want_aligner:
    print(f"aligner={h.get('funasr_forced_aligner_model_id')!r} want {want_aligner!r}", file=sys.stderr)
    sys.exit(1)
if not h.get("ready_for_transcribe"):
    print("ready_for_transcribe is false", file=sys.stderr)
    sys.exit(1)
plan = h.get("funasr_load_plan") or {}
if not plan.get("weights_cached_locally"):
    print(f"funasr_load_plan weights_cached_locally=false: {plan}", file=sys.stderr)
    sys.exit(1)
if plan.get("model_arg") != want_model:
    print(f"funasr_load_plan.model_arg={plan.get('model_arg')!r} want hub id {want_model!r}", file=sys.stderr)
    sys.exit(1)
print("OK: sidecar health matches spike env")
PY

echo ""
echo "PASS: R3g-B-Align preflight"

#!/usr/bin/env bash
# R3g-B-Align — Qwen3 + ForcedAligner spike (env-only; no catalog change).
# Hand-test: docs/execution/specs/r3g-b-align-forced-aligner-spike-hand-test-checklist.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"
export_asr_model_env

export RUSHI_FUNASR_MODEL="${RUSHI_FUNASR_MODEL:-Qwen/Qwen3-ASR-0.6B}"
export RUSHI_FUNASR_FORCED_ALIGNER="${RUSHI_FUNASR_FORCED_ALIGNER:-Qwen/Qwen3-ForcedAligner-0.6B}"

OUT_DIR="${SPIKE_OUTPUT_DIR:-docs/execution/spike-output/qwen3-align-$(date +%Y-%m-%d)}"
mkdir -p "$OUT_DIR"

echo "== R3g-B-Align spike =="
echo "ASR model: $RUSHI_FUNASR_MODEL"
echo "ForcedAligner: $RUSHI_FUNASR_FORCED_ALIGNER"
echo "Output: $OUT_DIR"

bash scripts/r3g-b-align-preflight.sh

echo ""
echo "-- unit tests --"
python3 -m pytest -q \
  services/asr/tests/test_asr_model_profile.py \
  services/asr/tests/test_model_prepare.py \
  services/asr/tests/test_funasr_engine.py

BASE="${ASR_BASE_URL:-http://127.0.0.1:8741}"
BASE="${BASE%/}"

if ! curl -sf "$BASE/health" >/dev/null 2>&1; then
  echo ""
  echo "SKIP transcribe: sidecar not at $BASE"
  echo "Start with env vars set, e.g.:"
  echo "  export RUSHI_FUNASR_MODEL=$RUSHI_FUNASR_MODEL"
  echo "  export RUSHI_FUNASR_FORCED_ALIGNER=$RUSHI_FUNASR_FORCED_ALIGNER"
  echo "  npm run asr:dev"
  exit 0
fi

echo ""
echo "-- /health --"
HEALTH="$(curl -sf "$BASE/health")"
echo "$HEALTH" | python3 -m json.tool | tee "$OUT_DIR/health.json"

ACTIVE_MODEL="$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('funasr_model_id') or '')")"
LOAD_LOCAL="$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('funasr_load_plan', {}).get('weights_cached_locally'))")"
if [ "$LOAD_LOCAL" != "True" ]; then
  echo ""
  echo "ERROR: funasr_load_plan.weights_cached_locally is not true — spike weights missing on disk."
  echo "Restart sidecar with latest code after: bash scripts/r3g-b-align-preflight.sh"
  exit 1
fi
if ! echo "$ACTIVE_MODEL" | python3 -c "import sys; m=sys.stdin.read(); sys.exit(0 if 'qwen' in m.lower() else 1)"; then
  echo ""
  echo "ERROR: sidecar is not running Qwen3 (funasr_model_id=$ACTIVE_MODEL)."
  echo "eval-run calls the live sidecar; exporting vars in this script does NOT switch models."
  echo ""
  echo "Restart sidecar with spike env, then re-run:"
  echo "  export RUSHI_FUNASR_MODEL=$RUSHI_FUNASR_MODEL"
  echo "  export RUSHI_FUNASR_FORCED_ALIGNER=$RUSHI_FUNASR_FORCED_ALIGNER"
  echo "  npm run asr:dev"
  echo "  curl -X POST $BASE/v1/models/prepare-default"
  echo "  bash scripts/r3g-b-align-forced-aligner-spike-hand-test.sh"
  exit 1
fi

echo "OK: sidecar reports Qwen model: $ACTIVE_MODEL"

READY="$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ready_for_transcribe'))")"
REQ_CACHED="$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin).get('funasr_required_models_cached'))")"
if [ "$READY" != "True" ] || [ "$REQ_CACHED" != "True" ]; then
  echo ""
  echo "ERROR: sidecar not ready for transcribe (ready_for_transcribe=$READY, funasr_required_models_cached=$REQ_CACHED)."
  echo "Run prepare-default after setting aligner env (downloads Qwen + VAD + ForcedAligner):"
  echo "  curl -X POST $BASE/v1/models/prepare-default"
  echo "  curl -sf $BASE/health | python3 -m json.tool"
  exit 1
fi

echo ""
echo "-- model warmup (loads Qwen + ForcedAligner from local cache; may take several minutes) --"
WARMUP_JSON="$(curl -sS -X POST --max-time 1800 "$BASE/v1/models/warmup" || true)"
if ! echo "$WARMUP_JSON" | python3 -m json.tool; then
  echo "$WARMUP_JSON"
  echo ""
  echo "ERROR: warmup failed. Restart sidecar with latest code, then retry."
  exit 1
fi
if ! echo "$WARMUP_JSON" | python3 -c "import json,sys; j=json.load(sys.stdin); sys.exit(0 if j.get('status')=='ok' else 1)"; then
  echo "ERROR: warmup did not return status=ok"
  exit 1
fi

echo ""
echo "-- long-form eval (制控) --"
npm run eval:run:long-form -- --no-warmup --output "$OUT_DIR/eval-report.json" | tee "$OUT_DIR/eval-report.stdout.json"

echo ""
echo "Fill results: docs/execution/specs/r3g-b-align-forced-aligner-spike-results.md"
echo "OK: R3g-B-Align machine prelude finished."

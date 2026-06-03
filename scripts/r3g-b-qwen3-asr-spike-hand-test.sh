#!/usr/bin/env bash
# R3g-B Qwen3-ASR spike — machine prelude (full spike needs GPU + model download).
# Hand-test: docs/execution/specs/r3g-b-qwen3-asr-spike-hand-test-checklist.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== R3g-B Qwen3 spike — machine prelude =="

echo "-- Python ASR unit tests (no Qwen weights required) --"
python3 -m pytest -q \
  services/asr/tests/test_funasr_engine.py \
  services/asr/tests/test_transcribe_windows.py \
  services/asr/tests/test_transcribe_job.py \
  services/asr/tests/test_asr_model_profile.py

BASE="${ASR_BASE_URL:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
MODEL="${RUSHI_FUNASR_MODEL:-}"

if ! curl -sf "$BASE/health" >/dev/null 2>&1; then
  echo ""
  echo "SKIP sidecar smoke: not reachable at $BASE"
  echo "Next: export RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B && npm run asr:dev"
  echo "Then re-run this script and complete:"
  echo "  docs/execution/specs/r3g-b-qwen3-asr-spike-hand-test-checklist.md"
  exit 0
fi

HEALTH="$(curl -sf "$BASE/health")"
echo ""
echo "-- Sidecar /health --"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"

if [[ -n "$MODEL" ]]; then
  echo ""
  echo "RUSHI_FUNASR_MODEL=$MODEL"
else
  echo ""
  echo "WARN: RUSHI_FUNASR_MODEL unset — sidecar may be on Paraformer/SenseVoice catalog default."
  echo "      For spike, restart with: export RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B"
fi

if python3 -c "import json,sys; j=json.load(sys.stdin); m=str(j.get('funasr_model_id') or j.get('model_id') or ''); sys.exit(0 if 'qwen' in m.lower() else 1)" <<<"$HEALTH" 2>/dev/null; then
  echo "OK: health reports a Qwen-family model."
else
  echo "NOTE: health does not report qwen in funasr_model_id — complete Phase 0 before S1–S4."
fi

echo ""
echo "Optional async API smoke (any model): bash scripts/r3e-c-hand-test.sh"
echo "Fill results: docs/execution/specs/r3g-b-qwen3-asr-spike-results.md"
echo "OK: R3g-B Qwen3 spike machine prelude passed."

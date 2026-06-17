#!/usr/bin/env bash
# R3g-C Fun-ASR-Nano spike — machine prelude (full spike needs ~2GB model download).
# Hand-test: docs/execution/specs/r3g-c-funasr-nano-hand-test-checklist.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NANO_MODEL="FunAudioLLM/Fun-ASR-Nano-2512"

echo "== R3g-C Fun-ASR-Nano spike — machine prelude =="

echo "-- Python ASR unit tests (no Nano weights required) --"
python3 -m pytest -q \
  services/asr/tests/test_asr_model_profile.py \
  services/asr/tests/test_model_prepare_cache.py \
  services/asr/tests/test_funasr_engine.py \
  services/asr/tests/test_funasr_pipeline.py

BASE="${ASR_BASE_URL:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
MODEL="${RUSHI_FUNASR_MODEL:-$NANO_MODEL}"

if ! curl -sf "$BASE/health" >/dev/null 2>&1; then
  echo ""
  echo "SKIP sidecar smoke: not reachable at $BASE"
  echo "Next:"
  echo "  export RUSHI_FUNASR_MODEL=$NANO_MODEL"
  echo "  RUSHI_ASR_DEV_RESTART=1 npm run asr:dev"
  echo "Then re-run this script and complete:"
  echo "  docs/execution/specs/r3g-c-funasr-nano-hand-test-checklist.md"
  exit 0
fi

HEALTH="$(curl -sf "$BASE/health")"
echo ""
echo "-- Sidecar /health --"
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"

echo ""
echo "RUSHI_FUNASR_MODEL=${MODEL}"

if python3 -c "import json,sys; j=json.load(sys.stdin); m=str(j.get('funasr_model_id') or j.get('model_id') or ''); sys.exit(0 if 'nano' in m.lower() or 'fun-asr' in m.lower() else 1)" <<<"$HEALTH" 2>/dev/null; then
  echo "OK: health reports a Fun-ASR-Nano-family model."
else
  echo "NOTE: health does not report Nano in funasr_model_id — complete Phase 0 before S1–S3."
  echo "      Restart with: export RUSHI_FUNASR_MODEL=$NANO_MODEL && RUSHI_ASR_DEV_RESTART=1 npm run asr:dev"
fi

echo ""
echo "Phase 1 compare script:"
echo "  python3 scripts/r3g-c-funasr-nano-spike-run.py"
echo "Fill results: docs/execution/specs/r3g-c-funasr-nano-spike-results.md"
echo "OK: R3g-C Fun-ASR-Nano spike machine prelude passed."

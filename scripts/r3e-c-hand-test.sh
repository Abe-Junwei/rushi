#!/usr/bin/env bash
# R3e-C smoke hand-test: sidecar async transcribe job API (no desktop UI).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${ASR_BASE_URL:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== R3e-C hand-test smoke =="
echo "ASR base: $BASE"

if ! curl -sf "$BASE/health" >/dev/null; then
  echo "SKIP: sidecar not reachable at $BASE (start desktop or rushi-asr first)"
  exit 0
fi

ROOT_JSON="$(curl -sf "$BASE/")"
if ! python3 -c "import json,sys; j=json.load(sys.stdin); assert 'transcribe_async' in j and '/v1/transcribe/async' in j.get('transcribe_async','')" <<<"$ROOT_JSON"; then
  echo "SKIP: sidecar missing transcribe_async (rebuild: npm run asr:build-sidecar-unix or npm run asr:dev)"
  exit 0
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "SKIP: ffmpeg not in PATH"
  exit 0
fi

# Multi-window smoke: restart sidecar with lowered async thresholds before running, e.g.
#   RUSHI_FUNASR_ASYNC_WINDOW_THRESHOLD_SEC=5 RUSHI_FUNASR_ASYNC_WINDOW_SEC=5 npm run asr:dev
# Default async preview uses 120s windows (≥120s audio); 20s silence still validates job API (N=1).

CURL_AUTH=()
if [[ -n "${RUSHI_LOCAL_TOKEN:-}" ]]; then
  CURL_AUTH=(-H "x-rushi-local-token: ${RUSHI_LOCAL_TOKEN}")
fi

WAV="$TMP/smoke.wav"
ffmpeg -y -f lavfi -i anullsrc=r=16000:cl=mono -t 20 "$WAV" -loglevel error

echo "POST /v1/transcribe/async ..."
START_JSON="$(curl -sf -X POST "${CURL_AUTH[@]}" "$BASE/v1/transcribe/async" -F "file=@$WAV")"
JOB_ID="$(python3 -c "import json,sys; print(json.load(sys.stdin)['job_id'])" <<<"$START_JSON")"
echo "job_id=$JOB_ID"

DEADLINE=$((SECONDS + 120))
PHASE="queued"
DELTA_TOTAL=0
while (( SECONDS < DEADLINE )); do
  ST="$(curl -sf "$BASE/v1/transcribe/status?job_id=$JOB_ID")"
  PHASE="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('phase','?'))" <<<"$ST")"
  DELTA="$(python3 -c "import json,sys; print(len(json.load(sys.stdin).get('segments_delta') or []))" <<<"$ST")"
  WIN="$(python3 -c "import json,sys; j=json.load(sys.stdin); print(f\"{j.get('window_index',0)}/{j.get('window_count',0)}\")" <<<"$ST")"
  DELTA_TOTAL=$((DELTA_TOTAL + DELTA))
  echo "  phase=$PHASE windows=$WIN delta_batch=$DELTA"
  if [[ "$PHASE" == "done" || "$PHASE" == "error" || "$PHASE" == "cancelled" ]]; then
    break
  fi
  sleep 1
done

if [[ "$PHASE" != "done" ]]; then
  echo "FAIL: expected phase=done, got $PHASE"
  echo "$ST" | python3 -m json.tool || true
  curl -sf -X POST "${CURL_AUTH[@]}" "$BASE/v1/transcribe/cancel" \
    -H 'Content-Type: application/json' \
    -d "{\"job_id\":\"$JOB_ID\"}" >/dev/null || true
  exit 1
fi

SEG_COUNT="$(python3 -c "import json,sys; print(len(json.load(sys.stdin).get('segments') or []))" <<<"$ST")"
echo "OK: phase=done segments=$SEG_COUNT cumulative_delta_batches=$DELTA_TOTAL"
echo "Note: FunASR may return 0 segments on silence; API path verified."

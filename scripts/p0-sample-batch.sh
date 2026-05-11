#!/usr/bin/env bash
# Generate short synthetic WAVs and POST each to local rushi-asr (P0 batch smoke).
# Prereqs: ffmpeg, curl; service: python -m rushi_asr (default 127.0.0.1:8741)

set -euo pipefail

BASE_URL="${RUSHI_ASR_BASE_URL:-http://127.0.0.1:8741}"
N="${1:-10}"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/rushi-p0-XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg required"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl required"; exit 1; }

curl -sfS "${BASE_URL}/health" | grep -q '"status"' || {
  echo "ASR not reachable at ${BASE_URL}/health — start: cd services/asr && python -m rushi_asr"
  exit 1
}

ok=0
for i in $(seq 1 "$N"); do
  f="${WORKDIR}/sample_${i}.wav"
  ffmpeg -hide_banner -nostdin -loglevel error -y \
    -f lavfi -i "sine=frequency=$((440 + i)):duration=0.15" \
    "$f"
  out="${WORKDIR}/out_${i}.json"
  code="$(curl -sS -o "$out" -w "%{http_code}" \
    -X POST "${BASE_URL}/v1/transcribe" \
    -F "file=@${f};type=audio/wav")"
  if [[ "$code" != "200" ]]; then
    echo "FAIL sample $i HTTP $code"
    cat "$out" || true
    exit 1
  fi
  export OUT_JSON="$out"
  python3 -c 'import json, os; d=json.load(open(os.environ["OUT_JSON"])); assert d.get("schema_version")=="1"; assert isinstance(d.get("segments"), list) and len(d["segments"])>=1; assert d.get("engine")'
  ok=$((ok + 1))
  echo "ok sample $i"
done

echo "p0-sample-batch: ${ok}/${N} passed"

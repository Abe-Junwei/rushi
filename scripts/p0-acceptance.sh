#!/usr/bin/env bash
# P0 batch acceptance: POST each of the first 10 fixtures/p0-samples/*.wav (sorted).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${RUSHI_ASR_BASE_URL:-http://127.0.0.1:8741}"
SAMPLES="$ROOT/fixtures/p0-samples"

curl -sfS "${BASE_URL}/health" >/dev/null || {
  echo "ASR not up at ${BASE_URL} — start: source services/asr/.venv/bin/activate && python -m rushi_asr"
  exit 1
}

shopt -s nullglob
tmp=("$SAMPLES"/*.wav)
FILES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && FILES+=("$line")
done < <(printf '%s\n' "${tmp[@]}" | LC_ALL=C sort)

if [[ ${#FILES[@]} -lt 10 ]]; then
  echo "Need at least 10 *.wav under $SAMPLES (found ${#FILES[@]})."
  echo "On macOS run: bash scripts/generate-p0-chinese-samples-macos.sh"
  exit 1
fi

export P0_REQUIRE_NONEMPTY_TEXT="${P0_REQUIRE_NONEMPTY_TEXT:-0}"
ok=0
for idx in $(seq 0 9); do
  f="${FILES[$idx]}"
  echo "---- $(basename "$f")"
  if ! curl -sS -X POST "${BASE_URL}/v1/transcribe" -F "file=@${f};type=audio/wav" \
    | python3 "$ROOT/scripts/validate_p0_transcription_result.py"; then
    echo "FAIL: $f"
    exit 1
  fi
  ok=$((ok + 1))
done

echo ""
echo "P0 acceptance: $ok/10 samples passed (P0_REQUIRE_NONEMPTY_TEXT=$P0_REQUIRE_NONEMPTY_TEXT)"

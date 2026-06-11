#!/usr/bin/env bash
# R3h-3.5 — run Sherpa Paraformer spike on a WAV sample.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPIKE_MANIFEST="$ROOT/apps/desktop/src-tauri/spike/sherpa_paraformer/Cargo.toml"
MODEL_DIR="${SHERPA_PARAFORMER_MODEL_DIR:-}"

if [[ -z "$MODEL_DIR" || ! -d "$MODEL_DIR" ]]; then
  echo "Set SHERPA_PARAFORMER_MODEL_DIR to extracted sherpa paraformer model directory."
  echo "See apps/desktop/src-tauri/spike/sherpa_paraformer/README.md"
  exit 1
fi

WAV="${1:-}"
if [[ -z "$WAV" ]]; then
  if [[ -f "$MODEL_DIR/test_wavs/0.wav" ]]; then
    WAV="$MODEL_DIR/test_wavs/0.wav"
    echo "default wav: model bundle test_wavs/0.wav (16 kHz mono)"
  else
    WAV="$ROOT/fixtures/eval/samples/clear.wav"
    echo "WARN: fixtures/eval/samples are 44.1 kHz / ~0.15 s placeholders — pass a 16 kHz mono wav"
  fi
fi

OUT_DIR="${SPIKE_OUTPUT_DIR:-$ROOT/docs/execution/spike-output/sherpa-paraformer-$(date +%Y-%m-%d)}"
mkdir -p "$OUT_DIR"

PROVIDER="${SHERPA_PROVIDER:-cpu}"
OUT_JSON="$OUT_DIR/$(basename "$WAV" .wav)-${PROVIDER}.json"

echo "== spike_sherpa_paraformer =="
echo "wav: $WAV"
echo "model_dir: $MODEL_DIR"
echo "provider: $PROVIDER"

cargo run --quiet --manifest-path "$SPIKE_MANIFEST" -- \
  --wav "$WAV" \
  --model-dir "$MODEL_DIR" \
  --provider "$PROVIDER" \
  --output "$OUT_JSON"

echo "OK: wrote $OUT_JSON"

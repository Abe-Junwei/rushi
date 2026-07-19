#!/usr/bin/env bash
# Official k2-fsa Qwen3-ASR-0.6B INT8 pack for the Sherpa spike.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/fixtures/sherpa-qwen3-asr-0.6B-int8-2026-03-25}"
URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25.tar.bz2"
TMP="${TMPDIR:-/tmp}/sherpa-qwen3-asr-0.6B-int8-2026-03-25.tar.bz2"

mkdir -p "$DEST"

if [[ -f "$DEST/conv_frontend.onnx" && -f "$DEST/encoder.int8.onnx" && -f "$DEST/decoder.int8.onnx" ]]; then
  echo "OK: official Sherpa Qwen3 pack already present at $DEST"
  echo "export SHERPA_QWEN3_MODEL_DIR=$DEST"
  exit 0
fi

echo "==> official k2-fsa Qwen3-ASR-0.6B INT8"
curl -L --http1.1 --fail --retry 8 --retry-delay 3 -C - -o "$TMP" "$URL"

if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "$TMP" | awk '{print $1}')"
else
  SHA256="$(shasum -a 256 "$TMP" | awk '{print $1}')"
fi

tar -xjf "$TMP" -C "$DEST" --strip-components=1
printf '%s\n' "$URL" > "$DEST/.source-url"
printf '%s\n' "$SHA256" > "$DEST/.archive-sha256"
rm -f "$TMP"

for required in conv_frontend.onnx encoder.int8.onnx decoder.int8.onnx tokenizer; do
  if [[ ! -e "$DEST/$required" ]]; then
    echo "FAIL: missing $required after extraction" >&2
    exit 1
  fi
done

echo "OK: $DEST"
echo "SHA256: $SHA256"
echo "export SHERPA_QWEN3_MODEL_DIR=$DEST"

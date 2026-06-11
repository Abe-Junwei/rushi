#!/usr/bin/env bash
# Download Sherpa P1 INT8 Paraformer model into fixtures/ (gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/fixtures/sherpa-paraformer-zh-int8-2025-10-07}"
URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-int8-2025-10-07.tar.bz2"
TMP="${TMPDIR:-/tmp}/sherpa-p1-int8.tar.bz2"

mkdir -p "$DEST"
echo "==> Download P1: sherpa-onnx-paraformer-zh-int8-2025-10-07"
echo "    dest: $DEST"
curl -L --fail --retry 3 -o "$TMP" "$URL"
tar -xjf "$TMP" -C "$DEST" --strip-components=1
rm -f "$TMP"
echo "OK: extracted to $DEST"
echo "export SHERPA_PARAFORMER_MODEL_DIR=$DEST"

#!/usr/bin/env bash
# Official Sherpa offline Chinese/English CT-Transformer punctuation model.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/fixtures/sherpa-punctuation-zh-en}"
URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/punctuation-models/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8.tar.bz2"
TMP="${TMPDIR:-/tmp}/sherpa-punctuation-zh-en-int8.tar.bz2"

mkdir -p "$DEST"
if [[ -f "$DEST/model.int8.onnx" ]]; then
  echo "OK: punctuation model already present at $DEST/model.int8.onnx"
  exit 0
fi

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

[[ -f "$DEST/model.int8.onnx" ]] || { echo "FAIL: model.int8.onnx missing" >&2; exit 1; }
echo "OK: $DEST/model.int8.onnx"
echo "SHA256: $SHA256"
echo "export SHERPA_PUNCTUATION_MODEL=$DEST/model.int8.onnx"

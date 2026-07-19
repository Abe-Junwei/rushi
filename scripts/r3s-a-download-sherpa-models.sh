#!/usr/bin/env bash
# Prepare only the three official model assets used by the Chinese A pipeline.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAD_DEST="${SHERPA_VAD_DEST:-$ROOT/fixtures/sherpa-vad}"
VAD_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"

bash "$ROOT/scripts/r3g-b-download-sherpa-qwen3-onnx.sh"

mkdir -p "$VAD_DEST"
if [[ ! -f "$VAD_DEST/silero_vad.onnx" ]]; then
  curl -L --http1.1 --fail --retry 8 --retry-delay 3 \
    -o "$VAD_DEST/silero_vad.onnx" "$VAD_URL"
fi
if command -v sha256sum >/dev/null 2>&1; then
  VAD_SHA256="$(sha256sum "$VAD_DEST/silero_vad.onnx" | awk '{print $1}')"
else
  VAD_SHA256="$(shasum -a 256 "$VAD_DEST/silero_vad.onnx" | awk '{print $1}')"
fi
printf '%s\n' "$VAD_URL" > "$VAD_DEST/.source-url"
printf '%s\n' "$VAD_SHA256" > "$VAD_DEST/.model-sha256"

bash "$ROOT/scripts/r3s-a-download-sherpa-punctuation.sh"

echo
echo "A pipeline models ready. Set:"
echo "export SHERPA_QWEN3_MODEL_DIR=$ROOT/fixtures/sherpa-qwen3-asr-0.6B-int8-2026-03-25"
echo "export SHERPA_SILERO_VAD_MODEL=$VAD_DEST/silero_vad.onnx"
echo "export SHERPA_PUNCTUATION_MODEL=$ROOT/fixtures/sherpa-punctuation-zh-en/model.int8.onnx"

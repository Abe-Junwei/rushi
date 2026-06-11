#!/usr/bin/env bash
# R3h-3.5 P2 — Silero VAD + Paraformer-large (zh-2024-03-09 INT8).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAD_DEST="${1:-$ROOT/fixtures/sherpa-vad}"
ASR_DEST="${2:-$ROOT/fixtures/sherpa-paraformer-zh-2024-03-09}"
VAD_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"
ASR_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-2024-03-09.tar.bz2"
TMP="${TMPDIR:-/tmp}/sherpa-p2-asr.tar.bz2"

mkdir -p "$VAD_DEST" "$ASR_DEST"

echo "==> P2 Silero VAD → $VAD_DEST/silero_vad.onnx"
if [[ ! -f "$VAD_DEST/silero_vad.onnx" ]]; then
  curl -L --http1.1 --fail --retry 5 -o "$VAD_DEST/silero_vad.onnx" "$VAD_URL"
else
  echo "    skip (exists)"
fi

echo "==> P2 Paraformer-large zh-2024-03-09 → $ASR_DEST"
if [[ ! -f "$ASR_DEST/tokens.txt" ]]; then
  curl -L --http1.1 --fail --retry 5 -o "$TMP" "$ASR_URL"
  tar -xjf "$TMP" -C "$ASR_DEST" --strip-components=1
  rm -f "$TMP"
else
  echo "    skip (exists)"
fi

echo "OK: P2 models ready"
echo "export SHERPA_SILERO_VAD_MODEL=$VAD_DEST/silero_vad.onnx"
echo "export SHERPA_PARAFORMER_MODEL_DIR=$ASR_DEST"
echo "export SHERPA_PIPELINE=p2"

#!/usr/bin/env bash
# R3h-3.5 — Sherpa Paraformer spike preflight (FunASR baseline + repo gates).
# Docs: docs/execution/specs/r3h-3.5-sherpa-spike-acceptance.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== R3h-3.5 Sherpa Paraformer spike preflight =="
echo "Baseline SKU: iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
echo "Sherpa P0: sherpa-onnx-paraformer-zh-2023-09-14"
echo "Sherpa P1: sherpa-onnx-paraformer-zh-int8-2025-10-07"
echo ""

echo "-- repo gates --"
npm run typecheck
npm run test
node scripts/check-architecture-guard.mjs

echo ""
echo "-- FunASR sidecar baseline (optional) --"
BASE="${ASR_BASE_URL:-http://127.0.0.1:8741}"
BASE="${BASE%/}"

if ! curl -sf "$BASE/health" >/dev/null 2>&1; then
  echo "SKIP: sidecar not at $BASE (start with npm run asr:dev for baseline CER/segment compare)"
else
  echo "OK: sidecar health at $BASE"
  curl -sf "$BASE/health" | head -c 2000
  echo ""
fi

echo ""
echo "-- spike crate unit tests --"
cargo test --quiet --manifest-path apps/desktop/src-tauri/spike/sherpa_paraformer/Cargo.toml

echo ""
echo "Next: export SHERPA_PARAFORMER_MODEL_DIR=... then:"
echo "  bash scripts/r3h-3.5-run-sherpa-spike.sh"
echo "  # or: bash scripts/r3h-3.5-run-sherpa-spike.sh \$SHERPA_PARAFORMER_MODEL_DIR/test_wavs/0.wav"
echo "Models: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-paraformer/paraformer-models.html"
echo "OK: preflight passed"

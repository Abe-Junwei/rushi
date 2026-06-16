#!/usr/bin/env bash
# R3g-B — Sherpa-ONNX Qwen3-ASR-0.6B INT8.
# Primary: ModelScope ONNX export (often faster in CN).
# Fallback: k2-fsa GitHub release tarball (curl resume).
#
# Weights live once under $MODELSCOPE_CACHE (same as desktop app). The fixtures
# path only holds symlinks for spike scripts — no copytree.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"
export_asr_model_env

DEST="${1:-$ROOT/fixtures/sherpa-qwen3-asr-0.6B}"
GITHUB_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25.tar.bz2"
TMP="${TMPDIR:-/tmp}/sherpa-qwen3-0.6b.tar.bz2"
ASR_VENV="$ROOT/services/asr/.venv/bin/python"
FORCE_GITHUB="${RUSHI_SHERPA_QWEN3_GITHUB_ONLY:-0}"

REPO_ID="zengshuishui/Qwen3-ASR-onnx"
CANONICAL_REPO="${MODELSCOPE_CACHE}/models/${REPO_ID}"
CANONICAL_MODEL="${CANONICAL_REPO}/model_0.6B"

link_dest_to_canonical() {
  local dest="$1"
  local canonical_model="$2"
  local canonical_repo="$3"

  rm -rf "$dest"
  mkdir -p "$dest"
  for item in "$canonical_model"/*; do
    [[ -e "$item" ]] || continue
    ln -sf "$item" "$dest/$(basename "$item")"
  done
  for name in tokenizer tokenizer.json vocab.json; do
    if [[ -e "$canonical_repo/$name" ]]; then
      ln -sf "$canonical_repo/$name" "$dest/$name"
    fi
  done
}

if [[ -f "$CANONICAL_MODEL/conv_frontend.onnx" ]]; then
  link_dest_to_canonical "$DEST" "$CANONICAL_MODEL" "$CANONICAL_REPO"
  echo "OK: Sherpa Qwen3 ONNX cached at $CANONICAL_MODEL"
  echo "    fixtures → symlinks at $DEST"
  echo "export SHERPA_QWEN3_MODEL_DIR=$DEST"
  echo "export RUSHI_MODELS_ROOT=$RUSHI_MODELS_ROOT"
  echo "export MODELSCOPE_CACHE=$MODELSCOPE_CACHE"
  exit 0
fi

download_via_modelscope() {
  [[ -x "$ASR_VENV" ]] || return 1
  echo "==> ModelScope ${REPO_ID} (model_0.6B) → ${CANONICAL_MODEL}"
  "$ASR_VENV" - <<'PY'
import os
import sys
from pathlib import Path

try:
    from modelscope import snapshot_download
except ImportError:
    raise SystemExit(1)

repo_id = "zengshuishui/Qwen3-ASR-onnx"
cache = Path(
    snapshot_download(
        repo_id,
        allow_patterns=["model_0.6B/*", "tokenizer/*", "tokenizer.json", "vocab.json"],
    )
)
model_dir = cache / "model_0.6B"
if not (model_dir / "conv_frontend.onnx").is_file():
    raise SystemExit(2)

ms_cache = os.environ.get("MODELSCOPE_CACHE", "").strip()
print(f"modelscope ok: {model_dir}")
if ms_cache:
    print(f"MODELSCOPE_CACHE={ms_cache}")
PY
}

download_via_github() {
  echo "==> GitHub k2-fsa release (resume) → $TMP"
  mkdir -p "$CANONICAL_MODEL"
  curl -L --http1.1 --fail --retry 8 --retry-delay 3 -C - \
    --connect-timeout 30 --speed-time 120 --speed-limit 1024 \
    -o "$TMP" "$GITHUB_URL"
  echo "==> extract → $CANONICAL_MODEL"
  tar -xjf "$TMP" -C "$CANONICAL_MODEL" --strip-components=1
  rm -f "$TMP"
}

echo "==> Sherpa Qwen3-ASR-0.6B INT8"
echo "    MODELSCOPE_CACHE=${MODELSCOPE_CACHE}"

if [[ "$FORCE_GITHUB" != "1" ]] && download_via_modelscope; then
  :
elif [[ -f "$TMP" ]]; then
  echo "    resume partial github tarball ($(du -h "$TMP" | awk '{print $1}'))"
  download_via_github
else
  download_via_github
fi

if [[ ! -f "$CANONICAL_MODEL/conv_frontend.onnx" ]]; then
  echo "FAIL: conv_frontend.onnx missing after download" >&2
  exit 1
fi

link_dest_to_canonical "$DEST" "$CANONICAL_MODEL" "$CANONICAL_REPO"

echo "OK: Sherpa Qwen3 ONNX ready"
echo "export SHERPA_QWEN3_MODEL_DIR=$DEST"
echo "export RUSHI_MODELS_ROOT=$RUSHI_MODELS_ROOT"
echo "export MODELSCOPE_CACHE=$MODELSCOPE_CACHE"

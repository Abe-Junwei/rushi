#!/usr/bin/env bash
# R3g-B — Sherpa-ONNX Qwen3-ASR-0.6B INT8.
# Primary: ModelScope ONNX export (often faster in CN).
# Fallback: k2-fsa GitHub release tarball (curl resume).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/fixtures/sherpa-qwen3-asr-0.6B}"
GITHUB_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25.tar.bz2"
TMP="${TMPDIR:-/tmp}/sherpa-qwen3-0.6b.tar.bz2"
ASR_VENV="$ROOT/services/asr/.venv/bin/python"
FORCE_GITHUB="${RUSHI_SHERPA_QWEN3_GITHUB_ONLY:-0}"

mkdir -p "$DEST"

if [[ -f "$DEST/conv_frontend.onnx" ]]; then
  echo "OK: Sherpa Qwen3 ONNX already at $DEST"
  echo "export SHERPA_QWEN3_MODEL_DIR=$DEST"
  exit 0
fi

download_via_modelscope() {
  [[ -x "$ASR_VENV" ]] || return 1
  echo "==> ModelScope zengshuishui/Qwen3-ASR-onnx (model_0.6B) → $DEST"
  "$ASR_VENV" - "$DEST" <<'PY'
import shutil
import sys
from pathlib import Path

dest = Path(sys.argv[1])
try:
    from modelscope import snapshot_download
except ImportError:
    raise SystemExit(1)

cache = snapshot_download(
    "zengshuishui/Qwen3-ASR-onnx",
    allow_patterns=["model_0.6B/*", "tokenizer/*", "tokenizer.json", "vocab.json"],
)
src = Path(cache) / "model_0.6B"
if not (src / "conv_frontend.onnx").is_file():
    raise SystemExit(2)

dest.mkdir(parents=True, exist_ok=True)
for item in src.iterdir():
    target = dest / item.name
    if item.is_dir():
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(item, target)
    else:
        shutil.copy2(item, target)

tok_root = Path(cache)
for name in ("tokenizer", "tokenizer.json", "vocab.json"):
    p = tok_root / name
    if p.exists() and not (dest / name).exists():
        if p.is_dir():
            shutil.copytree(p, dest / name)
        else:
            shutil.copy2(p, dest / name)

print(f"modelscope ok: {dest}")
PY
}

download_via_github() {
  echo "==> GitHub k2-fsa release (resume) → $TMP"
  curl -L --http1.1 --fail --retry 8 --retry-delay 3 -C - \
    --connect-timeout 30 --speed-time 120 --speed-limit 1024 \
    -o "$TMP" "$GITHUB_URL"
  echo "==> extract → $DEST"
  tar -xjf "$TMP" -C "$DEST" --strip-components=1
  rm -f "$TMP"
}

echo "==> Sherpa Qwen3-ASR-0.6B INT8"

if [[ "$FORCE_GITHUB" != "1" ]] && download_via_modelscope; then
  :
elif [[ -f "$TMP" ]]; then
  echo "    resume partial github tarball ($(du -h "$TMP" | awk '{print $1}'))"
  download_via_github
else
  download_via_github
fi

if [[ ! -f "$DEST/conv_frontend.onnx" ]]; then
  echo "FAIL: conv_frontend.onnx missing after download" >&2
  exit 1
fi

echo "OK: Sherpa Qwen3 ONNX ready"
echo "export SHERPA_QWEN3_MODEL_DIR=$DEST"

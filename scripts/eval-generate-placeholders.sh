#!/usr/bin/env bash
# 生成 P4 五类占位 wav（极短正弦），需 ffmpeg。用于 manifest 路径存在性冒烟。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/fixtures/eval/samples"
mkdir -p "$OUT"
FFMPEG="${FFMPEG:-ffmpeg}"
freq=420
for name in clear far_field noisy qa term_dense; do
  "$FFMPEG" -hide_banner -nostdin -y -f lavfi -i "sine=frequency=${freq}:duration=0.15" \
    "$OUT/${name}.wav" </dev/null
  freq=$((freq + 40))
done
echo "OK: wrote wav under $OUT"

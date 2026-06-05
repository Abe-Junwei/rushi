#!/usr/bin/env bash
# ⑤″f-D — ASR-VOC-3 机器闸门（复用 VOC-3 回归）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/asr-voc-3-hand-test.sh"

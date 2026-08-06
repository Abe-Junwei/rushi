#!/usr/bin/env bash
# Phase 0: FunASR-embedded Whisper vs Paraformer same-audio compare.
# Research: docs/execution/specs/r3g-whisper-funasr-sku-compare-research.md
# Results:  docs/execution/specs/r3g-whisper-funasr-sku-compare-results.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== R3g Whisper FunASR compare — hand-test prelude =="

PY="${PYTHON:-}"
if [[ -z "$PY" ]]; then
  if [[ -x "$ROOT/services/asr/.venv/bin/python" ]]; then
    PY="$ROOT/services/asr/.venv/bin/python"
  elif [[ -x "$ROOT/services/asr/.venv-lockgen-cpu/bin/python" ]]; then
    PY="$ROOT/services/asr/.venv-lockgen-cpu/bin/python"
  else
    PY="python3"
  fi
fi
echo "Python: $PY"

if ! "$PY" -c "import funasr" 2>/dev/null; then
  echo "FAIL: funasr not importable in $PY"
  echo "  cd services/asr && python3 -m venv .venv && .venv/bin/pip install -e '.[funasr]' openai-whisper"
  exit 2
fi

if ! "$PY" -c "import whisper" 2>/dev/null; then
  echo "FAIL: openai-whisper not installed"
  echo "  $PY -m pip install openai-whisper"
  exit 2
fi
echo "OK: funasr + openai-whisper"

if [[ -z "${RUSHI_MODELS_ROOT:-}" ]]; then
  LEGACY="$HOME/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/models"
  ALT="$HOME/Library/Application Support/studio.lingchuang.rushi/models"
  if [[ -d "$LEGACY" ]]; then
    export RUSHI_MODELS_ROOT="$LEGACY"
    export MODELSCOPE_CACHE="${MODELSCOPE_CACHE:-$LEGACY/modelscope}"
  elif [[ -d "$ALT" ]]; then
    export RUSHI_MODELS_ROOT="$ALT"
    export MODELSCOPE_CACHE="${MODELSCOPE_CACHE:-$ALT/modelscope}"
  fi
fi
echo "RUSHI_MODELS_ROOT=${RUSHI_MODELS_ROOT:-<unset>}"

OUT_DEFAULT="docs/execution/spike-output/whisper-funasr-compare"
export SPIKE_OUT_DIR="${SPIKE_OUT_DIR:-$ROOT/$OUT_DEFAULT}"
mkdir -p "$SPIKE_OUT_DIR"
echo "SPIKE_OUT_DIR=$SPIKE_OUT_DIR"

# Default short fixture clear.wav is ~0.15s placeholder — for W1 use a real clip, e.g.:
#   ffmpeg -y -ss 60 -t 29 -i fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3 \
#     -ac 1 -ar 16000 /tmp/rushi-d3-29s.wav
#   SPIKE_SHORT_AUDIO=/tmp/rushi-d3-29s.wav bash scripts/r3g-whisper-funasr-compare-hand-test.sh --short-only
MODE="${1:---short-only}"
shift || true

echo ""
echo "==> Running compare: $MODE $*"
"$PY" "$ROOT/scripts/r3g-whisper-funasr-compare-run.py" "$MODE" "$@"

echo ""
echo "Summary: $SPIKE_OUT_DIR/compare-summary.json"
echo "Fill gates: docs/execution/specs/r3g-whisper-funasr-sku-compare-results.md"
echo "OK: compare hand-test finished."

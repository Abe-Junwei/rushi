#!/usr/bin/env bash
# Install rushi-asr optional FunASR deps into services/asr/.venv (create venv if missing).
# Invoked by desktop shell after user picks repo root; requires python3, network, disk.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ASR="$ROOT/services/asr"
if [[ ! -f "$ASR/pyproject.toml" ]]; then
  echo "error: expected $ASR/pyproject.toml (is this the Rushi repo root?)" >&2
  exit 1
fi

command -v python3 >/dev/null 2>&1 || {
  echo "error: python3 not found in PATH" >&2
  exit 1
}

cd "$ASR"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
python -m pip install -U pip
python -m pip install -e ".[funasr]"
echo ""
echo "OK: FunASR optional dependencies installed under $ASR/.venv"
echo "Next: set RUSHI_FUNASR_MODEL (e.g. iic/SenseVoiceSmall), restart: python -m rushi_asr"

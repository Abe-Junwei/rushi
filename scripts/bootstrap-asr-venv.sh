#!/usr/bin/env bash
# Create an isolated venv under services/asr/.venv and install rushi-asr there.
# Avoids clobbering a shared/global env (Open WebUI, TensorFlow, etc.).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASR="$ROOT/services/asr"
cd "$ASR"

if [[ ! -f "$ASR/pyproject.toml" ]]; then
  echo "Expected $ASR/pyproject.toml — run this script from the Rushi repo (scripts/ is under repo root)."
  exit 1
fi

command -v python3 >/dev/null 2>&1 || { echo "python3 not found"; exit 1; }

python3 -m venv .venv
# shellcheck source=/dev/null
source .venv/bin/activate
python -m pip install -U pip
python -m pip install -e "."

echo ""
echo "Done. Start ASR (inside this venv, \`python\` is available):"
echo "  source \"$ASR/.venv/bin/activate\""
echo "  python -m rushi_asr"
echo ""
echo "Or without activating: \"$ASR/.venv/bin/python\" -m rushi_asr"

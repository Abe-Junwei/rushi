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
python -m pip install -e ".[dev]"

echo ""
echo "Done (includes dev: pytest / httpx). Run tests: python -m pytest"
echo "Or from repo root: npm run asr:test"
echo ""
echo "Start ASR with desktop model cache (recommended, from repo root):"
echo "  npm run asr:dev"
echo ""
echo "Manual start MUST set RUSHI_MODELS_ROOT (or weights go to ~/.cache, UI shows 未缓存):"
echo "  source \"$ASR/.venv/bin/activate\""
echo "  # see scripts/resolve-asr-models-root.sh for the canonical path"
echo "  export RUSHI_MODELS_ROOT=\"<Application Support>/studio.lingchuang.rushi/.../models\""
echo "  export MODELSCOPE_CACHE=\"\$RUSHI_MODELS_ROOT/modelscope\""
echo "  python -m rushi_asr"

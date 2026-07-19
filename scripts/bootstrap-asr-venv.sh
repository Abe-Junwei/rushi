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

HOST_PY="$(bash "${ROOT}/scripts/resolve-host-python312.sh")"
echo "==> Host Python: ${HOST_PY}"

# Broken/relocated venvs keep a dead `home=` (e.g. removed python.org install).
if [[ -d .venv ]]; then
  if ! .venv/Scripts/python.exe -c "import sys" 2>/dev/null \
    && ! .venv/bin/python -c "import sys" 2>/dev/null; then
    echo "==> Removing broken services/asr/.venv (base interpreter missing)…"
    rm -rf .venv
  fi
fi

"${HOST_PY}" -m venv .venv
if [[ -f ".venv/Scripts/activate" ]]; then
  # shellcheck source=/dev/null
  source ".venv/Scripts/activate"
elif [[ -f ".venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source ".venv/bin/activate"
else
  echo "venv activate script not found under $ASR/.venv"
  exit 1
fi
python -m pip install -U pip
python -m pip install -e ".[funasr,dev]"
# funasr may not pull torch/torchaudio on some platforms; sidecar needs both.
if ! python -c "import torch,torchaudio" 2>/dev/null; then
  echo "==> Installing PyTorch + torchaudio (CPU wheels) into ASR venv…"
  python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

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

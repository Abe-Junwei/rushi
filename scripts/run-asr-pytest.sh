#!/usr/bin/env bash
# Create/use services/asr/.venv with Python 3.11+, pip install -e ".[dev]", run pytest.
# Mirrors .github/workflows/ci.yml asr job (global pip there can drift; local + CI use this venv).
#
# Override:
#   RUSHI_ASR_TEST_PYTHON=/path/to/python3.12
#   RUSHI_ASR_VENV=/path/to/custom/venv   (default: services/asr/.venv)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASR="$ROOT/services/asr"
cd "$ASR"

if [[ ! -f pyproject.toml ]]; then
  echo "Expected services/asr/pyproject.toml — run from Rushi repo root."
  exit 1
fi

resolve_py() {
  if [[ -n "${RUSHI_ASR_TEST_PYTHON:-}" ]]; then
    printf "%s" "$RUSHI_ASR_TEST_PYTHON"
    return 0
  fi
  for c in python3.12 python3.11 python3; do
    command -v "$c" >/dev/null 2>&1 || continue
    if "$c" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)'; then
      printf "%s" "$c"
      return 0
    fi
  done
  return 1
}

PY="$(resolve_py)" || {
  echo "rushi-asr pytest: need Python 3.11+ on PATH, or set RUSHI_ASR_TEST_PYTHON."
  exit 1
}

VENV="${RUSHI_ASR_VENV:-$ASR/.venv}"
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "Creating venv: $VENV ($PY -m venv)"
  "$PY" -m venv "$VENV"
fi
# shellcheck source=/dev/null
source "$VENV/bin/activate"
PY_BIN="$VENV/bin/python"
"$PY_BIN" -m pip install -q -U pip
"$PY_BIN" -m pip install -q -e ".[dev]"
exec "$PY_BIN" -m pytest "$@"

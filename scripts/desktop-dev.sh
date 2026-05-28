#!/usr/bin/env bash
# Dev desktop: source ASR on 8741 + skip PyInstaller bundled sidecar (always current Python code).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"

ASR_DIR="$ROOT/services/asr"
VENV_PY="$ASR_DIR/.venv/bin/python"
ASR_BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
ASR_PID=""
STARTED_ASR=0

cleanup() {
  if [[ "$STARTED_ASR" == "1" && -n "$ASR_PID" ]]; then
    kill "$ASR_PID" 2>/dev/null || true
    wait "$ASR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

sidecar_looks_current() {
  curl -sf --max-time 2 "${ASR_BASE}/" 2>/dev/null | python3 -c "
import json, sys
try:
    v = json.load(sys.stdin)
except Exception:
    sys.exit(1)
sys.exit(0 if 'prepare-cancel' in str(v.get('prepare_cancel', '')) else 1)
" 2>/dev/null
}

health_models_root_matches() {
  export_asr_model_env
  curl -sf --max-time 2 "${ASR_BASE}/health" 2>/dev/null | python3 -c "
import json, sys, os
h = json.load(sys.stdin)
root = (h.get('rushi_models_root') or '').strip()
expected = os.environ.get('RUSHI_MODELS_ROOT', '').strip()
sys.exit(0 if root and expected and root.rstrip('/') == expected.rstrip('/') else 1)
" 2>/dev/null
}

stop_sidecar_on_8741() {
  local pids
  pids="$(lsof -ti :8741 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "==> Stopping process on 8741 (${pids})…"
    kill ${pids} 2>/dev/null || true
    sleep 1
  fi
}

ensure_venv() {
  if [[ -x "$VENV_PY" ]]; then
    return 0
  fi
  echo "==> Creating services/asr/.venv (first run)…"
  bash "$ROOT/scripts/bootstrap-asr-venv.sh"
}

ensure_funasr() {
  if "$VENV_PY" -c "import funasr" 2>/dev/null; then
    return 0
  fi
  echo "==> Installing FunASR into ASR venv (one-time)…"
  (cd "$ASR_DIR" && "$VENV_PY" -m pip install -q -e ".[funasr]")
}

start_source_sidecar() {
  ensure_venv
  ensure_funasr
  export_asr_model_env
  echo "==> Starting rushi-asr from source on ${ASR_BASE}…"
  echo "    RUSHI_MODELS_ROOT=${RUSHI_MODELS_ROOT}"
  "$VENV_PY" -m rushi_asr >>"${TMPDIR:-/tmp}/rushi-asr-dev.log" 2>&1 &
  ASR_PID=$!
  STARTED_ASR=1
  for _ in $(seq 1 60); do
    if curl -sf --max-time 1 "${ASR_BASE}/health" >/dev/null 2>&1; then
      echo "==> ASR ready (log: ${TMPDIR:-/tmp}/rushi-asr-dev.log)"
      return 0
    fi
    sleep 0.5
  done
  echo "FAIL: ASR did not become healthy within 30s. See ${TMPDIR:-/tmp}/rushi-asr-dev.log" >&2
  exit 1
}

if curl -sf --max-time 2 "${ASR_BASE}/health" >/dev/null 2>&1; then
  if sidecar_looks_current; then
    if health_models_root_matches; then
      export_asr_model_env
      echo "==> Using existing ASR on 8741 (models: ${RUSHI_MODELS_ROOT})"
    else
      echo "==> 8741 ASR is up but not using app model cache — restarting with RUSHI_MODELS_ROOT…"
      stop_sidecar_on_8741
      start_source_sidecar
    fi
  else
    echo "FAIL: 8741 is in use but the process looks like an old bundled sidecar." >&2
    echo "      Stop it (Activity Monitor / lsof -i :8741) and re-run: npm run desktop:dev" >&2
    exit 1
  fi
else
  start_source_sidecar
fi

export RUSHI_SKIP_BUNDLED_ASR=1
cd "$ROOT"
exec npm run tauri dev -w @rushi/desktop -- "$@"

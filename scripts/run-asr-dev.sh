#!/usr/bin/env bash
# Start rushi-asr on 127.0.0.1:8741 with the same model cache paths as the desktop app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"

ASR_DIR="${ROOT}/services/asr"
VENV_PY="${ASR_DIR}/.venv/bin/python"
ASR_BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"

if [[ ! -x "${VENV_PY}" ]]; then
  echo "==> Creating services/asr/.venv…"
  bash "${ROOT}/scripts/bootstrap-asr-venv.sh"
fi

if ! "${VENV_PY}" -c "import funasr" 2>/dev/null; then
  echo "==> Installing FunASR (one-time)…"
  (cd "${ASR_DIR}" && "${VENV_PY}" -m pip install -q -e ".[funasr]")
fi

export_asr_model_env

# Apply saved hub preference when desktop app has written it.
APP_DATA_ROOT="$(dirname "${RUSHI_MODELS_ROOT}")"
PREF_FILE="${APP_DATA_ROOT}/prefs/funasr_hub_model_id.txt"
if [[ -z "${RUSHI_FUNASR_MODEL:-}" && -f "${PREF_FILE}" ]]; then
  hub="$(tr -d '\r\n' < "${PREF_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -n "${hub}" ]]; then
    export RUSHI_FUNASR_MODEL="${hub}"
    echo "==> RUSHI_FUNASR_MODEL=${hub} (from desktop pref)"
  fi
fi

if curl -sf --max-time 2 "${ASR_BASE}/health" >/dev/null 2>&1; then
  echo "WARN: ${ASR_BASE} already in use. Stop it first (lsof -i :8741) if you need a fresh process with updated env." >&2
fi

echo "==> RUSHI_MODELS_ROOT=${RUSHI_MODELS_ROOT}"
echo "==> ASR only (no Tauri). In another terminal: npm run desktop:dev"
echo "    Or use one command: npm run desktop:dev (reuses 8741 if this process is running)."
echo "==> Starting rushi-asr (foreground). Log also: ${TMPDIR:-/tmp}/rushi-asr-dev.log"
cd "${ASR_DIR}"
exec "${VENV_PY}" -m rushi_asr 2>&1 | tee -a "${TMPDIR:-/tmp}/rushi-asr-dev.log"

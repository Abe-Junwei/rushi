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

if [[ -n "${RUSHI_HF_ENDPOINT:-}" ]]; then
  export HF_ENDPOINT="${HF_ENDPOINT:-$RUSHI_HF_ENDPOINT}"
fi

# R3g-B-Align spike: ForcedAligner only pairs with Qwen3-ASR — skip desktop Paraformer pref.
ALIGN_SPIKE=0
if [[ -n "${RUSHI_FUNASR_FORCED_ALIGNER:-}" ]]; then
  ALIGN_SPIKE=1
  model_lc="$(printf '%s' "${RUSHI_FUNASR_MODEL:-}" | tr '[:upper:]' '[:lower:]')"
  if [[ -z "${RUSHI_FUNASR_MODEL:-}" || "${model_lc}" != *qwen* ]]; then
    echo "WARN: R3g-B-Align spike: using Qwen/Qwen3-ASR-0.6B (ForcedAligner requires Qwen ASR)." >&2
    export RUSHI_FUNASR_MODEL="Qwen/Qwen3-ASR-0.6B"
  fi
fi

# Apply saved hub preference when desktop app has written it.
APP_DATA_ROOT="$(dirname "${RUSHI_MODELS_ROOT}")"
PREF_FILE="${APP_DATA_ROOT}/prefs/funasr_hub_model_id.txt"
if [[ "${ALIGN_SPIKE}" -eq 0 && -z "${RUSHI_FUNASR_MODEL:-}" && -f "${PREF_FILE}" ]]; then
  hub="$(tr -d '\r\n' < "${PREF_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -n "${hub}" ]]; then
    export RUSHI_FUNASR_MODEL="${hub}"
    echo "==> RUSHI_FUNASR_MODEL=${hub} (from desktop pref)"
  fi
fi

LANG_PREF_FILE="${APP_DATA_ROOT}/prefs/funasr_language.txt"
if [[ -z "${RUSHI_FUNASR_LANGUAGE:-}" && -f "${LANG_PREF_FILE}" ]]; then
  lang="$(tr -d '\r\n' < "${LANG_PREF_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -n "${lang}" ]]; then
    export RUSHI_FUNASR_LANGUAGE="${lang}"
    echo "==> RUSHI_FUNASR_LANGUAGE=${lang} (from desktop pref)"
  fi
fi

stop_sidecar_on_8741() {
  local pids
  pids="$(lsof -ti :8741 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "==> Stopping process on 8741 (${pids})…"
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 1
  fi
}

health_sidecar_snapshot() {
  curl -sf --max-time 2 "${ASR_BASE}/health" 2>/dev/null || true
}

health_funasr_model_id() {
  echo "$(health_sidecar_snapshot)" | python3 -c "
import json, sys
raw = sys.stdin.read().strip()
if not raw:
    print('')
    raise SystemExit
try:
    j = json.loads(raw)
    print(j.get('funasr_loaded_model_id') or j.get('funasr_model_id') or '')
except Exception:
    print('')
" 2>/dev/null || true
}

sidecar_matches_want_env() {
  local snap want_model want_aligner active_model active_aligner
  snap="$(health_sidecar_snapshot)"
  [[ -n "${snap}" ]] || return 1
  want_model="${RUSHI_FUNASR_MODEL:-}"
  want_aligner="${RUSHI_FUNASR_FORCED_ALIGNER:-}"
  read -r active_model active_aligner <<< "$(printf '%s' "${snap}" | python3 -c "
import json, sys
j = json.load(sys.stdin)
print(j.get('funasr_model_id') or '', j.get('funasr_forced_aligner_model_id') or '')
")"
  if [[ -n "${want_model}" && "${active_model}" != "${want_model}" && "${active_model}" != *"${want_model##*/}"* ]]; then
    return 1
  fi
  if [[ -n "${want_aligner}" && "${active_aligner}" != "${want_aligner}" ]]; then
    return 1
  fi
  return 0
}

if curl -sf --max-time 2 "${ASR_BASE}/health" >/dev/null 2>&1; then
  loaded="$(health_funasr_model_id)"
  want="${RUSHI_FUNASR_MODEL:-}"
  if sidecar_matches_want_env; then
    echo "==> ${ASR_BASE} already running with ${loaded:-configured model}"
    echo "    Reuse it, or: RUSHI_ASR_DEV_RESTART=1 npm run asr:dev"
    exit 0
  fi
  echo "WARN: ${ASR_BASE} sidecar env mismatch." >&2
  echo "      loaded/configured model: ${loaded:-unknown}" >&2
  echo "      wanted model: ${want:-<unset>}" >&2
  echo "      wanted aligner: ${RUSHI_FUNASR_FORCED_ALIGNER:-<unset>}" >&2
  if [[ "${RUSHI_ASR_DEV_RESTART:-}" == "1" ]]; then
    stop_sidecar_on_8741
  else
    echo "      Restart with:" >&2
    echo "        RUSHI_ASR_DEV_RESTART=1 npm run asr:dev" >&2
    echo "      Or: lsof -ti :8741 | xargs kill && npm run asr:dev" >&2
    exit 1
  fi
fi

echo "==> RUSHI_MODELS_ROOT=${RUSHI_MODELS_ROOT}"
if [[ -n "${RUSHI_FUNASR_MODEL:-}" ]]; then
  echo "==> RUSHI_FUNASR_MODEL=${RUSHI_FUNASR_MODEL}"
fi
if [[ -n "${RUSHI_FUNASR_FORCED_ALIGNER:-}" ]]; then
  echo "==> RUSHI_FUNASR_FORCED_ALIGNER=${RUSHI_FUNASR_FORCED_ALIGNER}"
fi
if [[ -n "${RUSHI_HF_ENDPOINT:-}" ]]; then
  echo "==> HF_ENDPOINT=${HF_ENDPOINT:-$RUSHI_HF_ENDPOINT}"
fi
echo "==> ASR only (no Tauri). In another terminal: npm run desktop:dev"
echo "    Or use one command: npm run desktop:dev (reuses 8741 if this process is running)."
echo "==> Starting rushi-asr (foreground). Log also: ${TMPDIR:-/tmp}/rushi-asr-dev.log"
cd "${ASR_DIR}"
exec "${VENV_PY}" -m rushi_asr 2>&1 | tee -a "${TMPDIR:-/tmp}/rushi-asr-dev.log"

#!/usr/bin/env bash
# Canonical Rushi desktop models directory (must match apps/desktop/src-tauri project/app_data_paths.rs).
resolve_asr_models_root() {
  if [[ -n "${APPDATA:-}" ]] && [[ "$(uname -s)" =~ MINGW|MSYS|CYGWIN ]]; then
    local app_support="${APPDATA}/studio.lingchuang.rushi"
    local legacy="${app_support}/studio.lingchuang.rushi"
    if [[ -f "${legacy}/rushi.sqlite3" || -d "${legacy}/models" || -d "${legacy}/projects" ]]; then
      echo "${legacy}/models"
      return 0
    fi
    echo "${app_support}/models"
    return 0
  fi
  if [[ "$(uname -s)" == "Darwin" ]]; then
    local app_support="${HOME}/Library/Application Support/studio.lingchuang.rushi"
    local legacy="${app_support}/studio.lingchuang.rushi"
    if [[ -f "${legacy}/rushi.sqlite3" || -d "${legacy}/models" || -d "${legacy}/projects" ]]; then
      echo "${legacy}/models"
      return 0
    fi
    echo "${app_support}/models"
    return 0
  fi
  local xdg="${XDG_DATA_HOME:-${HOME}/.local/share}"
  local app_support="${xdg}/studio.lingchuang.rushi"
  local legacy="${app_support}/studio.lingchuang.rushi"
  if [[ -f "${legacy}/rushi.sqlite3" || -d "${legacy}/models" || -d "${legacy}/projects" ]]; then
    echo "${legacy}/models"
    return 0
  fi
  echo "${app_support}/models"
}

export_asr_model_env() {
  export RUSHI_MODELS_ROOT="${RUSHI_MODELS_ROOT:-$(resolve_asr_models_root)}"
  export MODELSCOPE_CACHE="${MODELSCOPE_CACHE:-${RUSHI_MODELS_ROOT}/modelscope}"
  export HF_HOME="${HF_HOME:-${RUSHI_MODELS_ROOT}/huggingface}"
  mkdir -p "${RUSHI_MODELS_ROOT}" "${MODELSCOPE_CACHE}" "${HF_HOME}" 2>/dev/null || true
}

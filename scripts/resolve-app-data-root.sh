#!/usr/bin/env bash
# Print canonical Rushi app-data root (flat or legacy nested).
set -euo pipefail
BUNDLE_ID="${RUSHI_BUNDLE_ID:-studio.lingchuang.rushi}"
BASE="${HOME}/Library/Application Support/${BUNDLE_ID}"
LEGACY="${BASE}/studio.lingchuang.rushi"

if [[ -f "${LEGACY}/rushi.sqlite3" ]] || [[ -d "${LEGACY}/projects" ]] || [[ -d "${LEGACY}/models" ]]; then
  echo "${LEGACY}"
else
  echo "${BASE}"
fi

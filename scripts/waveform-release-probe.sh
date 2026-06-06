#!/usr/bin/env bash
# Release waveform chain — filesystem probe (no UI). Run while .app is closed or after opening a file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DATA="$(bash "${ROOT}/scripts/resolve-app-data-root.sh")"
DB="${APP_DATA}/rushi.sqlite3"
LOG="${APP_DATA}/logs/desktop.log"

echo "== waveform release probe =="
echo "App data: ${APP_DATA}"

if [[ ! -f "${DB}" ]]; then
  echo "FAIL: no database at ${DB}" >&2
  exit 1
fi

echo ""
echo "## DB files with audio"
sqlite3 "${DB}" "SELECT project_id, id, name, audio_path FROM files WHERE audio_path IS NOT NULL AND TRIM(audio_path) != '' LIMIT 10;"

echo ""
echo "## Peaks on disk (sample)"
find "${APP_DATA}/projects" -name '*_L0.dat' 2>/dev/null | head -5 || echo "(none)"

echo ""
echo "## Bundled ffmpeg in release .app"
APP="${RUSHI_RELEASE_APP:-${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app}"
if FFMPEG="$(bash "${ROOT}/scripts/resolve-bundled-tool-in-app.sh" "${APP}" ffmpeg 2>/dev/null)"; then
  echo "OK: ${FFMPEG}"
else
  echo "WARN: bundled ffmpeg not found (build .app first)"
fi

echo ""
echo "## Recent waveform / asset log lines"
if [[ -f "${LOG}" ]]; then
  grep -E 'asset_scope|waveform_peaks|waveform |ui waveform' "${LOG}" | tail -15 || echo "(no waveform lines yet — open a file in release .app)"
else
  echo "WARN: no ${LOG}"
fi

echo ""
echo "Tip: rebuild .app then open project; errors appear as 'ERROR ui waveform …' in desktop.log"
echo "     RUSHI_DEVTOOLS=1 open \"${APP}\"  # optional Web Inspector"

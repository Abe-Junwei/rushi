#!/usr/bin/env bash
# Resolve bundled sidecar _internal tool inside a macOS .app.
# Tauri copies tauri.conf "resources/*" to Contents/Resources/resources/*.
set -euo pipefail
APP="${1:?usage: resolve-bundled-tool-in-app.sh /path/to/App.app [ffmpeg|ffprobe]}"
TOOL="${2:-ffmpeg}"
RES="${APP}/Contents/Resources"

for root in "${RES}/resources" "${RES}"; do
  for onedir in rushi-asr-sidecar rushi-asr-sidecar-cuda; do
    candidate="${root}/bundled-asr/${onedir}/_internal/${TOOL}"
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      exit 0
    fi
  done
done

echo "bundled ${TOOL} not found under ${APP}/Contents/Resources" >&2
exit 1

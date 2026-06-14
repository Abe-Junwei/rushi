#!/usr/bin/env bash
# Resolve bundled sidecar build stamp inside a macOS .app.
set -euo pipefail
APP="${1:?usage: resolve-bundled-sidecar-stamp-in-app.sh /path/to/App.app}"
RES="${APP}/Contents/Resources"

for root in "${RES}/resources" "${RES}"; do
  for onedir in rushi-asr-sidecar rushi-asr-sidecar-cuda; do
    candidate="${root}/bundled-asr/${onedir}/sidecar-build-stamp.txt"
    if [[ -s "${candidate}" ]]; then
      echo "${candidate}"
      exit 0
    fi
  done
done

echo "bundled sidecar build stamp not found under ${APP}/Contents/Resources" >&2
exit 1

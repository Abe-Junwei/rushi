#!/usr/bin/env bash
# Post-build release sanity: bundled sidecar paths + optional waveform probe.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

APP_GLOB="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/"*.app
APP=""
for candidate in ${APP_GLOB}; do
  if [[ -d "${candidate}" ]]; then
    APP="${candidate}"
    break
  fi
done

if [[ -z "${APP}" ]]; then
  echo "release-postbuild-verify: no macOS .app under target/release/bundle/macos/" >&2
  exit 1
fi

echo "== release postbuild verify =="
echo "  app: ${APP}"

bash scripts/resolve-bundled-tool-in-app.sh "${APP}" ffmpeg
bash scripts/resolve-bundled-tool-in-app.sh "${APP}" ffprobe

SIDECAR="${APP}/Contents/Resources/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar"
if [[ ! -x "${SIDECAR}" ]]; then
  echo "FAIL: bundled sidecar missing: ${SIDECAR}" >&2
  exit 1
fi
echo "  sidecar: OK"

if [[ "${RUSHI_SKIP_WAVEFORM_PROBE:-0}" -eq 0 ]]; then
  bash scripts/waveform-release-probe.sh "${APP}"
else
  echo "  SKIP: RUSHI_SKIP_WAVEFORM_PROBE=1"
fi

echo "OK: release postbuild verify passed"

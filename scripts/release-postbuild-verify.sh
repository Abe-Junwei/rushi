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

BIN="${APP}/Contents/MacOS/rushi-desktop"
if [[ ! -x "${BIN}" ]]; then
  echo "FAIL: app binary missing: ${BIN}" >&2
  exit 1
fi
echo "  app binary: OK"

bash scripts/resolve-bundled-tool-in-app.sh "${APP}" ffmpeg
bash scripts/resolve-bundled-tool-in-app.sh "${APP}" ffprobe

SIDECAR="${APP}/Contents/Resources/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar"
if [[ ! -x "${SIDECAR}" ]]; then
  echo "FAIL: bundled sidecar missing: ${SIDECAR}" >&2
  exit 1
fi
echo "  sidecar: OK"

STAMP="$(bash scripts/resolve-bundled-sidecar-stamp-in-app.sh "${APP}")"
if [[ ! -s "${STAMP}" ]]; then
  echo "FAIL: bundled sidecar build stamp missing: ${STAMP}" >&2
  exit 1
fi
echo "  sidecar stamp: $(tr '\n' ' ' < "${STAMP}" | sed 's/[[:space:]]*$//')"

if [[ ! -d "${APP}/Contents/Resources/resources" ]]; then
  echo "FAIL: expected Tauri resource layout missing: Contents/Resources/resources" >&2
  exit 1
fi
echo "  resource layout: OK"

if [[ "${RUSHI_SKIP_WAVEFORM_PROBE:-0}" -eq 0 ]]; then
  bash scripts/waveform-release-probe.sh "${APP}"
else
  echo "  SKIP: RUSHI_SKIP_WAVEFORM_PROBE=1"
fi

echo "OK: release postbuild verify passed"

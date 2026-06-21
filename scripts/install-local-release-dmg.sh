#!/usr/bin/env bash
# Install local Release DMG + wipe App Data models (Plan B fresh seed retest).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARG="${1:-${ROOT}/如是我闻_0.1.8_aarch64.dmg}"
APP_NAME="如是我闻.app"
INSTALL_DIR="/Applications"
APP_DATA="${HOME}/Library/Application Support/studio.lingchuang.rushi"

echo "== Stop running app =="
pkill -f "rushi-desktop" 2>/dev/null || true
pkill -f "${APP_NAME}" 2>/dev/null || true
sleep 1

echo "== Wipe App Data models (keep projects/db) =="
rm -rf "${APP_DATA}/models"
echo "  removed ${APP_DATA}/models"

if [[ -d "${ARG}" && "${ARG}" == *".app" ]]; then
  SRC="${ARG}"
elif [[ -d "${ARG}/${APP_NAME}" ]]; then
  SRC="${ARG}/${APP_NAME}"
elif [[ -f "${ARG}" && "${ARG}" == *.dmg ]]; then
  MOUNT="$(hdiutil attach "${ARG}" -nobrowse -noverify | awk '/\/Volumes\// {print $3; exit}')"
  if [[ -z "${MOUNT}" ]]; then
    echo "FAIL: could not mount DMG" >&2
    exit 1
  fi
  trap 'hdiutil detach "${MOUNT}" -quiet 2>/dev/null || true' EXIT
  SRC="${MOUNT}/${APP_NAME}"
else
  echo "FAIL: pass path to .dmg or .app: ${ARG}" >&2
  exit 1
fi

if [[ ! -d "${SRC}" ]]; then
  echo "FAIL: ${APP_NAME} not found at ${SRC}" >&2
  exit 1
fi

echo "== Install to ${INSTALL_DIR} =="
rm -rf "${INSTALL_DIR}/${APP_NAME}"
ditto "${SRC}" "${INSTALL_DIR}/${APP_NAME}"

BUNDLED="${INSTALL_DIR}/${APP_NAME}/Contents/Resources/resources/bundled-asr-models"
if [[ ! -d "${BUNDLED}/modelscope" ]]; then
  echo "FAIL: installed app missing bundled-asr-models/modelscope" >&2
  exit 1
fi
echo "  bundled-asr-models: $(du -sh "${BUNDLED}" | awk '{print $1}')"

echo ""
echo "OK: installed ${INSTALL_DIR}/${APP_NAME}"
echo "Open: open -a \"${INSTALL_DIR}/${APP_NAME}\""
echo "First launch should show fullscreen seed overlay (no ModelScope download)."

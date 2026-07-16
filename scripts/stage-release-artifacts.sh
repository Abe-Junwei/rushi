#!/usr/bin/env bash
# Copy DMG (and symlink .app when present) to repo root after Tauri build — easy to find.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DMG_DIR="${ROOT}/apps/desktop/src-tauri/target/release/bundle/dmg"
APP_DIR="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos"
PRODUCT_NAME="$(cd "$ROOT" && node -p "require('./apps/desktop/src-tauri/tauri.conf.json').productName" 2>/dev/null || echo '如是我闻')"

stage_dmg() {
  local dmg staged=0
  shopt -s nullglob
  for dmg in "${DMG_DIR}"/*.dmg; do
    [[ -f "${dmg}" ]] || continue
    local dest="${ROOT}/$(basename "${dmg}")"
    echo "stage release: ${dmg} -> ${dest}"
    cp -f "${dmg}" "${dest}"
    staged=1
  done
  shopt -u nullglob
  if [[ "${staged}" -eq 0 ]]; then
    echo "stage release: no .dmg under ${DMG_DIR}"
    return 1
  fi
  return 0
}

stage_app_symlink() {
  local app dest name
  shopt -s nullglob
  for app in "${APP_DIR}"/"${PRODUCT_NAME}.app" "${APP_DIR}"/*.app; do
    [[ -d "${app}" ]] || continue
    name="$(basename "${app}")"
    dest="${ROOT}/${name}"
    if [[ -e "${dest}" && ! -L "${dest}" ]]; then
      echo "stage release: skip app symlink — ${dest} exists and is not a symlink" >&2
      shopt -u nullglob
      return 0
    fi
    echo "stage release: ${dest} -> ${app}"
    ln -sfn "${app}" "${dest}"
    shopt -u nullglob
    return 0
  done
  shopt -u nullglob
  echo "stage release: no .app under ${APP_DIR}"
}

echo "== stage release artifacts at repo root =="
DMG_OK=0
stage_dmg && DMG_OK=1 || true
stage_app_symlink || true

if [[ "${DMG_OK}" -eq 1 ]]; then
  ls -lh "${ROOT}"/*.dmg 2>/dev/null || true
  echo ""
  echo "OK: installer DMG at ${ROOT}/"
else
  echo ""
  echo "OK: staged app symlink (no DMG this build)"
  ls -lh "${ROOT}/${PRODUCT_NAME}.app" 2>/dev/null || ls -lh "${ROOT}"/*.app 2>/dev/null || true
fi

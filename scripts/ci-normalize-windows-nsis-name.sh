#!/usr/bin/env bash
# Rename Windows NSIS installer to stable ASCII filename for CDN + OTA manifest.
set -euo pipefail

BUNDLE_ROOT=""

usage() {
  echo "Usage: $0 --bundle-root PATH" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --bundle-root)
      BUNDLE_ROOT="${2:-}"
      shift 2
      ;;
    -h | --help)
      usage
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      ;;
  esac
done

if [ -z "$BUNDLE_ROOT" ]; then
  usage
fi

NSIS_DIR="${BUNDLE_ROOT}/nsis"
TARGET="${NSIS_DIR}/rushi-desktop-setup.exe"

shopt -s nullglob
setup_files=("$NSIS_DIR"/*-setup.exe)
if [ ${#setup_files[@]} -eq 0 ]; then
  echo "No NSIS *-setup.exe found under ${NSIS_DIR}" >&2
  ls -la "$NSIS_DIR" 2>/dev/null || true
  exit 1
fi

SOURCE="${setup_files[0]}"
if [ "$(basename "$SOURCE")" = "$(basename "$TARGET")" ]; then
  echo "NSIS installer already normalized: $(basename "$TARGET")"
  exit 0
fi

mv "$SOURCE" "$TARGET"
if [ -f "${SOURCE}.sig" ]; then
  mv "${SOURCE}.sig" "${TARGET}.sig"
fi
echo "Renamed $(basename "$SOURCE") -> $(basename "$TARGET")"

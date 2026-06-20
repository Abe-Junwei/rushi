#!/usr/bin/env bash
# Rename macOS DMG to stable ASCII filename (CI strips non-ASCII productName prefix).
set -euo pipefail

BUNDLE_ROOT=""
VERSION=""

usage() {
  echo "Usage: $0 --bundle-root PATH --version X.Y.Z" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --bundle-root)
      BUNDLE_ROOT="${2:-}"
      shift 2
      ;;
    --version)
      VERSION="${2:-}"
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

if [ -z "$BUNDLE_ROOT" ] || [ -z "$VERSION" ]; then
  usage
fi

DMG_DIR="${BUNDLE_ROOT}/dmg"
TARGET="${DMG_DIR}/rushi-desktop_${VERSION}_aarch64.dmg"

shopt -s nullglob
dmg_files=("$DMG_DIR"/*.dmg)
if [ ${#dmg_files[@]} -eq 0 ]; then
  echo "No DMG found under ${DMG_DIR}" >&2
  exit 1
fi

SOURCE="${dmg_files[0]}"
if [ "$(basename "$SOURCE")" = "$(basename "$TARGET")" ]; then
  echo "DMG already normalized: $(basename "$TARGET")"
  exit 0
fi

mv "$SOURCE" "$TARGET"
echo "Renamed $(basename "$SOURCE") -> $(basename "$TARGET")"

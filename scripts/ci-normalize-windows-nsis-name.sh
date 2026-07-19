#!/usr/bin/env bash
# Rename Windows NSIS installer to the Chinese product+version CDN filename.
set -euo pipefail

BUNDLE_ROOT=""
VERSION=""

usage() {
  echo "Usage: $0 --bundle-root PATH [--version X.Y.Z]" >&2
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

if [ -z "$BUNDLE_ROOT" ]; then
  usage
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/rushi-win-release-artifact-names.sh
source "$ROOT/scripts/rushi-win-release-artifact-names.sh"
VERSION="$(rushi_win_normalize_version "$VERSION")"
TARGET_NAME="$(rushi_win_nsis_setup_name "$VERSION")"

NSIS_DIR="${BUNDLE_ROOT}/nsis"
TARGET="${NSIS_DIR}/${TARGET_NAME}"

shopt -s nullglob
# Prefer a fresh Tauri-generated setup over a normalized target left by a same-version rerun.
setup_files=("$NSIS_DIR"/*-setup.exe)
if [ ${#setup_files[@]} -eq 0 ]; then
  setup_files=("$NSIS_DIR"/*.exe)
fi
# Exclude the normalized target and temporary upload aliases from fresh-source candidates.
filtered=()
for f in "${setup_files[@]}"; do
  case "$f" in
    "$TARGET"|*/rushi-win-nsis-upload.exe|*.sig) continue ;;
    *) filtered+=("$f") ;;
  esac
done
setup_files=("${filtered[@]}")

if [ ${#setup_files[@]} -gt 1 ]; then
  echo "Ambiguous NSIS outputs under ${NSIS_DIR}; refusing to pick a stale installer:" >&2
  printf '  %s\n' "${setup_files[@]}" >&2
  exit 1
fi

if [ ${#setup_files[@]} -eq 0 ] && [ -f "$TARGET" ]; then
  echo "NSIS installer already normalized and no fresh source exists: $(basename "$TARGET")"
  exit 0
fi

if [ ${#setup_files[@]} -eq 0 ]; then
  echo "No NSIS setup .exe found under ${NSIS_DIR}" >&2
  ls -la "$NSIS_DIR" 2>/dev/null || true
  exit 1
fi

SOURCE="${setup_files[0]}"
rm -f "$TARGET" "${TARGET}.sig"
mv "$SOURCE" "$TARGET"
if [ -f "${SOURCE}.sig" ]; then
  mv "${SOURCE}.sig" "${TARGET}.sig"
fi
# Drop legacy English alias if present (avoid shipping two names by accident).
if [ -f "${NSIS_DIR}/rushi-desktop-setup.exe" ] && [ "$(basename "$TARGET")" != "rushi-desktop-setup.exe" ]; then
  rm -f "${NSIS_DIR}/rushi-desktop-setup.exe"
  rm -f "${NSIS_DIR}/rushi-desktop-setup.exe.sig"
fi
echo "Renamed $(basename "$SOURCE") -> $(basename "$TARGET")"

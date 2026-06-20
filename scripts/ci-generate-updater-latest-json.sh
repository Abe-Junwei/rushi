#!/usr/bin/env bash
# Generate Tauri static updater manifest (latest.json) for GitHub Release.
# Requires: jq, macOS .app.tar.gz + .sig from createUpdaterArtifacts build.
set -euo pipefail

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> --repository <owner/repo> [--bundle-root PATH] [--platform darwin-aarch64]" >&2
  exit 1
}

TAG=""
REPO=""
BUNDLE_ROOT="apps/desktop/src-tauri/target/release/bundle"
PLATFORM="darwin-aarch64"

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --repository)
      REPO="${2:-}"
      shift 2
      ;;
    --bundle-root)
      BUNDLE_ROOT="${2:-}"
      shift 2
      ;;
    --platform)
      PLATFORM="${2:-}"
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

if [ -z "$TAG" ] || [ -z "$REPO" ]; then
  usage
fi

MACOS_DIR="${BUNDLE_ROOT}/macos"
shopt -s nullglob
tar_files=("$MACOS_DIR"/*.tar.gz)
sig_files=("$MACOS_DIR"/*.tar.gz.sig)

if [ ${#tar_files[@]} -eq 0 ] || [ ${#sig_files[@]} -eq 0 ]; then
  echo "Missing updater bundle under ${MACOS_DIR} (*.tar.gz + *.tar.gz.sig)" >&2
  echo "Ensure createUpdaterArtifacts=true and TAURI_SIGNING_PRIVATE_KEY is set." >&2
  ls -la "$MACOS_DIR" 2>/dev/null || true
  exit 1
fi

TAR_GZ="${tar_files[0]}"
SIG_FILE="${sig_files[0]}"
TAR_NAME="$(basename "$TAR_GZ")"
VERSION="${TAG#v}"
URL="https://github.com/${REPO}/releases/download/${TAG}/${TAR_NAME}"
PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SIGNATURE="$(tr -d '\n' < "$SIG_FILE")"
OUT="${MACOS_DIR}/latest.json"

jq -n \
  --arg version "$VERSION" \
  --arg notes "Release ${TAG}" \
  --arg pub_date "$PUB_DATE" \
  --arg platform "$PLATFORM" \
  --arg url "$URL" \
  --arg signature "$SIGNATURE" \
  '{
    version: $version,
    notes: $notes,
    pub_date: $pub_date,
    platforms: {
      ($platform): {
        url: $url,
        signature: $signature
      }
    }
  }' > "$OUT"

echo "Wrote ${OUT}"
echo "Updater bundle: ${TAR_GZ}"
echo "Signature: ${SIG_FILE}"

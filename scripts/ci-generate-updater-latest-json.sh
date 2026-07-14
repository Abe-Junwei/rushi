#!/usr/bin/env bash
# Generate Tauri static updater manifest (latest.json) for R2 CDN (+ optional GitHub mirror).
# Requires: jq, macOS app.tar.gz + app.tar.gz.sig (normalized name).
set -euo pipefail

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> [--cdn-base URL] [--bundle-root PATH] [--platform darwin-aarch64]" >&2
  exit 1
}

TAG=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
BUNDLE_ROOT="apps/desktop/src-tauri/target/release/bundle"
PLATFORM="darwin-aarch64"
UPDATER_BUNDLE_NAME="app.tar.gz"

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --cdn-base)
      CDN_BASE="${2:-}"
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
    # Backward-compatible no-op (GitHub repo no longer used for package URL).
    --repository)
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

if [ -z "$TAG" ]; then
  usage
fi

CDN_BASE="${CDN_BASE%/}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# OTA compares against tauri.conf.json / package.json — not git tag suffix (e.g. v0.1.8.3 tag → app 0.1.8).
VERSION="$(node -p "require('${ROOT}/apps/desktop/package.json').version")"

MACOS_DIR="${BUNDLE_ROOT}/macos"
TAR_GZ="${MACOS_DIR}/${UPDATER_BUNDLE_NAME}"
SIG_FILE="${TAR_GZ}.sig"

if [ ! -f "$TAR_GZ" ] || [ ! -f "$SIG_FILE" ]; then
  echo "Missing normalized updater bundle:" >&2
  echo "  expected: ${TAR_GZ}" >&2
  echo "  expected: ${SIG_FILE}" >&2
  ls -la "$MACOS_DIR" 2>/dev/null || true
  exit 1
fi

# Stable layout on updates.rushi.app:
#   /latest.json
#   /<tag>/app.tar.gz
#   /<tag>/app.tar.gz.sig
URL="${CDN_BASE}/${TAG}/${UPDATER_BUNDLE_NAME}"
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
echo "Manifest package URL: ${URL}"
echo "Client endpoint should fetch: ${CDN_BASE}/latest.json"

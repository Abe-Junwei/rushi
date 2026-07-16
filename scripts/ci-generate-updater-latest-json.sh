#!/usr/bin/env bash
# Generate a per-platform updater manifest fragment for R2 CDN (merged at release verify).
# Requires: jq.
set -euo pipefail

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> [--cdn-base URL] [--bundle-root PATH] [--platform darwin-aarch64|windows-x86_64] [--out PATH]" >&2
  exit 1
}

TAG=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
BUNDLE_ROOT="apps/desktop/src-tauri/target/release/bundle"
PLATFORM="darwin-aarch64"
OUT=""

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
    --out)
      OUT="${2:-}"
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
# OTA compares against tauri.conf.json / package.json — not git tag suffix.
# Resolve via cwd-relative require so Git Bash paths work on Windows runners
# (node cannot require('/d/a/.../package.json')).
VERSION="$(cd "$ROOT" && node -p "require('./apps/desktop/package.json').version")"

case "$PLATFORM" in
  darwin-aarch64)
    ARTIFACT_DIR="${BUNDLE_ROOT}/macos"
    BUNDLE_FILE="${ARTIFACT_DIR}/app.tar.gz"
    CDN_BUNDLE_NAME="app.tar.gz"
    ;;
  windows-x86_64)
    ARTIFACT_DIR="${BUNDLE_ROOT}/nsis"
    BUNDLE_FILE="${ARTIFACT_DIR}/rushi-desktop-setup.exe"
    CDN_BUNDLE_NAME="rushi-desktop-setup.exe"
    ;;
  *)
    echo "Unsupported platform: ${PLATFORM}" >&2
    exit 1
    ;;
esac

SIG_FILE="${BUNDLE_FILE}.sig"

if [ ! -f "$BUNDLE_FILE" ] || [ ! -f "$SIG_FILE" ]; then
  echo "Missing updater bundle for ${PLATFORM}:" >&2
  echo "  expected: ${BUNDLE_FILE}" >&2
  echo "  expected: ${SIG_FILE}" >&2
  ls -la "$ARTIFACT_DIR" 2>/dev/null || true
  exit 1
fi

if [ -z "$OUT" ]; then
  OUT="${ARTIFACT_DIR}/updater-fragment.json"
fi

URL="${CDN_BASE}/${TAG}/${CDN_BUNDLE_NAME}"
PUB_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SIGNATURE="$(tr -d '\n' < "$SIG_FILE")"

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
echo "Platform: ${PLATFORM}"
echo "Updater bundle: ${BUNDLE_FILE}"
echo "Manifest package URL: ${URL}"

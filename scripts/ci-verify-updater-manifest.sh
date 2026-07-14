#!/usr/bin/env bash
# Verify CDN-hosted OTA manifest + package (no GitHub Release assets required).
set -euo pipefail

TAG=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> [--cdn-base URL]" >&2
  exit 1
}

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
    # Backward-compatible no-op.
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
APP_VERSION="$(node -p "require('${ROOT}/apps/desktop/package.json').version")"
EXPECTED_URL="${CDN_BASE}/${TAG}/app.tar.gz"
LATEST_URL="${CDN_BASE}/latest.json"

http_code() {
  local url="$1"
  curl -fsSIL "$url" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}'
}

HTTP_LATEST="$(http_code "$LATEST_URL")"
HTTP_TAR="$(http_code "$EXPECTED_URL")"

if [ "$HTTP_LATEST" != "200" ]; then
  echo "CDN latest.json not reachable (HTTP ${HTTP_LATEST}): ${LATEST_URL}" >&2
  exit 1
fi
if [ "$HTTP_TAR" != "200" ]; then
  echo "CDN app.tar.gz not reachable (HTTP ${HTTP_TAR}): ${EXPECTED_URL}" >&2
  exit 1
fi

JSON="$(curl -fsSL "$LATEST_URL")"
MANIFEST_VERSION="$(echo "$JSON" | jq -r '.version')"
TAR_URL="$(echo "$JSON" | jq -r '.platforms["darwin-aarch64"].url // empty')"

if [ -z "$MANIFEST_VERSION" ] || [ "$MANIFEST_VERSION" = "null" ]; then
  echo "latest.json missing version field." >&2
  exit 1
fi

if [ "$MANIFEST_VERSION" != "$APP_VERSION" ]; then
  echo "CDN latest.json version must match apps/desktop/package.json." >&2
  echo "  cdn: ${MANIFEST_VERSION}" >&2
  echo "  package.json: ${APP_VERSION}" >&2
  exit 1
fi

if [ "$TAR_URL" != "$EXPECTED_URL" ]; then
  echo "latest.json darwin-aarch64.url must be the CDN package URL." >&2
  echo "  expected: ${EXPECTED_URL}" >&2
  echo "  got:      ${TAR_URL}" >&2
  exit 1
fi

echo "OTA CDN OK: version=${MANIFEST_VERSION} url=${EXPECTED_URL}"

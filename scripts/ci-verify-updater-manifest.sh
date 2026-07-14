#!/usr/bin/env bash
# Verify GitHub Release OTA assets + CDN-facing latest.json URLs before publishing.
set -euo pipefail

TAG=""
REPO=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> [--repository OWNER/REPO] [--cdn-base URL]" >&2
  exit 1
}

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
    --cdn-base)
      CDN_BASE="${2:-}"
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

REPO="${GITHUB_REPOSITORY:-$REPO}"
if [ -z "$REPO" ]; then
  echo "--repository or GITHUB_REPOSITORY is required." >&2
  exit 1
fi

if ! gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release ${TAG} not found." >&2
  exit 1
fi

mapfile -t asset_names < <(gh release view "$TAG" --json assets -q '.assets[].name')

has_asset() {
  local name="$1"
  local item
  for item in "${asset_names[@]}"; do
    if [ "$item" = "$name" ]; then
      return 0
    fi
  done
  return 1
}

missing=0
for required in latest.json app.tar.gz app.tar.gz.sig; do
  if ! has_asset "$required"; then
    echo "Missing release asset: ${required}" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "OTA manifest incomplete on ${TAG}." >&2
  exit 1
fi

# Draft releases return 404 on public download URLs until published — fetch via gh API instead.
VERIFY_DIR="$(mktemp -d)"
cleanup_verify_dir() {
  rm -rf "$VERIFY_DIR"
}
trap cleanup_verify_dir EXIT

gh release download "$TAG" --repo "$REPO" --pattern "latest.json" --dir "$VERIFY_DIR"
JSON="$(cat "${VERIFY_DIR}/latest.json")"
MANIFEST_VERSION="$(echo "$JSON" | jq -r '.version')"
APP_VERSION="$(node -p "require('./apps/desktop/package.json').version")"
TAR_URL="$(echo "$JSON" | jq -r '.platforms["darwin-aarch64"].url // empty')"
EXPECTED_URL="${CDN_BASE}/${TAG}/app.tar.gz"

if [ -z "$MANIFEST_VERSION" ] || [ "$MANIFEST_VERSION" = "null" ]; then
  echo "latest.json missing version field." >&2
  exit 1
fi

if [ "$MANIFEST_VERSION" != "$APP_VERSION" ]; then
  echo "latest.json version must match apps/desktop/package.json for OTA semver." >&2
  echo "  manifest: ${MANIFEST_VERSION}" >&2
  echo "  package.json: ${APP_VERSION}" >&2
  exit 1
fi

if [ "$TAR_URL" != "$EXPECTED_URL" ]; then
  echo "latest.json darwin-aarch64.url must be the CDN package URL." >&2
  echo "  expected: ${EXPECTED_URL}" >&2
  echo "  got:      ${TAR_URL}" >&2
  exit 1
fi

# Live CDN checks (public HTTPS).
HTTP_LATEST="$(curl -fsSIL "${CDN_BASE}/latest.json" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}')"
HTTP_TAR="$(curl -fsSIL "$EXPECTED_URL" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}')"
if [ "$HTTP_LATEST" != "200" ]; then
  echo "CDN latest.json not reachable (HTTP ${HTTP_LATEST}): ${CDN_BASE}/latest.json" >&2
  exit 1
fi
if [ "$HTTP_TAR" != "200" ]; then
  echo "CDN app.tar.gz not reachable (HTTP ${HTTP_TAR}): ${EXPECTED_URL}" >&2
  exit 1
fi

CDN_VERSION="$(curl -fsSL "${CDN_BASE}/latest.json" | jq -r '.version')"
if [ "$CDN_VERSION" != "$APP_VERSION" ]; then
  echo "CDN latest.json version mismatch." >&2
  echo "  cdn: ${CDN_VERSION}" >&2
  echo "  package.json: ${APP_VERSION}" >&2
  exit 1
fi

echo "OTA manifest OK: version=${MANIFEST_VERSION} cdn=${EXPECTED_URL}"

#!/usr/bin/env bash
# Verify GitHub Release has OTA manifest + signed bundle before publishing.
set -euo pipefail

TAG=""
REPO=""

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> [--repository OWNER/REPO]" >&2
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

MANIFEST_URL="https://github.com/${REPO}/releases/download/${TAG}/latest.json"

JSON="$(curl -fsSL "$MANIFEST_URL")"
MANIFEST_VERSION="$(echo "$JSON" | jq -r '.version')"
TAR_URL="$(echo "$JSON" | jq -r '.platforms["darwin-aarch64"].url // empty')"
EXPECTED_SUFFIX="/releases/download/${TAG}/app.tar.gz"

if [ -z "$MANIFEST_VERSION" ] || [ "$MANIFEST_VERSION" = "null" ]; then
  echo "latest.json missing version field." >&2
  exit 1
fi

if [[ "$TAR_URL" != *"$EXPECTED_SUFFIX" ]]; then
  echo "latest.json darwin-aarch64.url must end with ${EXPECTED_SUFFIX}" >&2
  echo "  got: ${TAR_URL}" >&2
  exit 1
fi

echo "OTA manifest OK: version=${MANIFEST_VERSION} url=*${EXPECTED_SUFFIX}"

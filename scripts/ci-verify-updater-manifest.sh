#!/usr/bin/env bash
# Verify CDN-hosted OTA manifest + packages for macOS and Windows.
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
APP_VERSION="$(cd "$ROOT" && node -p "require('./apps/desktop/package.json').version")"
# shellcheck source=scripts/rushi-win-release-artifact-names.sh
source "$ROOT/scripts/rushi-win-release-artifact-names.sh"
WIN_NSIS_NAME="$(rushi_win_nsis_setup_name "$APP_VERSION")"
WIN_OFFLINE_NAME="$(rushi_win_offline_installer_zip_name "$APP_VERSION")"
LATEST_URL="${CDN_BASE}/latest.json"

http_code() {
  local url="$1"
  # Percent-encode non-ASCII path segments for HTTP (CDN keys remain UTF-8).
  local fetch_url
  fetch_url="$(
    python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=":/?#[]@!$&'"'"'()*+,;="))' "$url" 2>/dev/null \
      || node -e 'const u=process.argv[1]; console.log(encodeURI(u))' "$url"
  )"
  curl -fsSIL "$fetch_url" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}'
}

hash_command() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum
  else
    shasum -a 256
  fi
}

verify_remote_checksum() {
  local label="$1"
  local asset_url="$2"
  local checksum_url="$3"
  local checksum_fetch asset_fetch expected actual
  checksum_fetch="$(
    python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=":/?#[]@!$&'"'"'()*+,;="))' "$checksum_url" 2>/dev/null \
      || node -e 'console.log(encodeURI(process.argv[1]))' "$checksum_url"
  )"
  asset_fetch="$(
    python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=":/?#[]@!$&'"'"'()*+,;="))' "$asset_url" 2>/dev/null \
      || node -e 'console.log(encodeURI(process.argv[1]))' "$asset_url"
  )"
  expected="$(curl -fsSL "$checksum_fetch" | awk 'NR==1 {print tolower($1)}')"
  if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Invalid CDN checksum for ${label}: ${checksum_url}" >&2
    exit 1
  fi
  actual="$(curl -fsSL "$asset_fetch" | hash_command | awk '{print tolower($1)}')"
  if [ "$actual" != "$expected" ]; then
    echo "CDN checksum mismatch for ${label}: expected ${expected}, got ${actual}" >&2
    exit 1
  fi
  echo "CDN hash OK [${label}]: ${actual}"
}

# When merge uploaded no latest.json this run (no OTA fragments), skip hard latest checks.
REQUIRE_LATEST="${RUSHI_VERIFY_REQUIRE_LATEST:-true}"
JSON=""
MANIFEST_VERSION=""

verify_platform() {
  local platform="$1"
  local expected_bundle="$2"
  # required=1 fail closed; required=0 soft (unsigned / missing .sig releases)
  local required="${3:-1}"
  local url signature http_pkg

  url="$(echo "$JSON" | jq -r --arg p "$platform" '.platforms[$p].url // empty')"
  signature="$(echo "$JSON" | jq -r --arg p "$platform" '.platforms[$p].signature // empty')"

  if [ -z "$url" ] || [ -z "$signature" ]; then
    if [ "$required" = "1" ]; then
      echo "latest.json missing platforms.${platform}.url or .signature" >&2
      exit 1
    fi
    echo "::warning::latest.json omits platforms.${platform} (OTA skip for this platform; offline zip CDN may still be required)."
    return 0
  fi

  local expected_url="${CDN_BASE}/${TAG}/${expected_bundle}"
  if [ "$url" != "$expected_url" ]; then
    echo "latest.json ${platform}.url must be the CDN package URL." >&2
    echo "  expected: ${expected_url}" >&2
    echo "  got:      ${url}" >&2
    exit 1
  fi

  http_pkg="$(http_code "$url")"
  if [ "$http_pkg" != "200" ]; then
    echo "CDN package not reachable for ${platform} (HTTP ${http_pkg}): ${url}" >&2
    exit 1
  fi

  echo "OTA CDN OK [${platform}]: url=${url}"
}

if [ "$REQUIRE_LATEST" = "false" ]; then
  echo "::warning::Skipping latest.json version/platform checks (no OTA fragments merged this run)."
else
  HTTP_LATEST="$(http_code "$LATEST_URL")"
  if [ "$HTTP_LATEST" != "200" ]; then
    echo "CDN latest.json not reachable (HTTP ${HTTP_LATEST}): ${LATEST_URL}" >&2
    exit 1
  fi

  JSON="$(curl -fsSL "$LATEST_URL")"
  MANIFEST_VERSION="$(echo "$JSON" | jq -r '.version')"

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

  # After a successful latest.json upload, both platforms must be complete (OTA gate).
  verify_platform "darwin-aarch64" "app.tar.gz" 1
  verify_platform "windows-x86_64" "$WIN_NSIS_NAME" 1
  verify_remote_checksum \
    "windows-nsis" \
    "${CDN_BASE}/${TAG}/${WIN_NSIS_NAME}" \
    "${CDN_BASE}/${TAG}/${WIN_NSIS_NAME}.sha256"
fi

verify_url() {
  local label="$1"
  local url="$2"
  local required="${3:-1}"
  local code
  code="$(http_code "$url")"
  if [ "$code" = "200" ]; then
    echo "CDN OK [${label}]: ${url}"
    return 0
  fi
  if [ "$required" = "1" ]; then
    echo "CDN asset not reachable for ${label} (HTTP ${code}): ${url}" >&2
    exit 1
  fi
  echo "::warning::CDN asset missing for ${label} (HTTP ${code}): ${url}"
}

# Offline zip is hard when Windows job succeeded; soft when verify runs mac-only.
# RUSHI_VERIFY_REQUIRE_PORTABLE kept as alias for older callers.
REQUIRE_OFFLINE="${RUSHI_VERIFY_REQUIRE_OFFLINE:-${RUSHI_VERIFY_REQUIRE_PORTABLE:-true}}"
if [ "$REQUIRE_OFFLINE" = "false" ]; then
  verify_url "windows-offline" "${CDN_BASE}/${TAG}/${WIN_OFFLINE_NAME}" 0
  verify_url "windows-offline.sha256" "${CDN_BASE}/${TAG}/${WIN_OFFLINE_NAME}.sha256" 0
else
  verify_url "windows-offline" "${CDN_BASE}/${TAG}/${WIN_OFFLINE_NAME}" 1
  verify_url "windows-offline.sha256" "${CDN_BASE}/${TAG}/${WIN_OFFLINE_NAME}.sha256" 1
  verify_remote_checksum \
    "windows-offline" \
    "${CDN_BASE}/${TAG}/${WIN_OFFLINE_NAME}" \
    "${CDN_BASE}/${TAG}/${WIN_OFFLINE_NAME}.sha256"
fi
verify_url "windows-nsis.sha256" "${CDN_BASE}/${TAG}/${WIN_NSIS_NAME}.sha256" 0

if [ -n "$MANIFEST_VERSION" ]; then
  echo "OTA CDN OK: version=${MANIFEST_VERSION}"
else
  echo "Offline/install CDN OK (latest.json not verified this run)."
fi

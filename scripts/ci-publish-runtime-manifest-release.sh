#!/usr/bin/env bash
# Release CI: package sidecar zip, sign manifest, emit URLs for compile-time injection + gh upload.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPOSITORY=""
TAG=""

usage() {
  cat <<'EOF'
Usage: ci-publish-runtime-manifest-release.sh --repository OWNER/REPO --tag RELEASE_TAG

Requires:
  RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX   Ed25519 private key (64 hex chars)

Writes:
  dist/rushi-asr-sidecar-<platform>.zip
  dist/runtime-manifest/rushi-runtime-manifest-<platform>.json

Optional (CI):
  GITHUB_OUTPUT   appends platform_key, zip_path, manifest_path, manifest_url, artifact_url
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repository) REPOSITORY="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "${REPOSITORY}" || -z "${TAG}" ]]; then
  echo "ERROR: --repository and --tag are required." >&2
  usage
  exit 1
fi

if [[ -z "${RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX:-}" ]]; then
  echo "ERROR: RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX is not set." >&2
  echo "Add repository secret before publishing a GitHub Release." >&2
  exit 1
fi

if ! python3 -c "import cryptography" 2>/dev/null; then
  echo "Installing cryptography for manifest signing..."
  python3 -m pip install --quiet cryptography
fi

PLATFORM_KEY=""
ZIP_PATH=""
while IFS= read -r line; do
  case "${line}" in
    platform_key=*) PLATFORM_KEY="${line#platform_key=}" ;;
    zip_path=*) ZIP_PATH="${line#zip_path=}" ;;
  esac
done < <(bash "${ROOT}/scripts/package-sidecar-ota-zip.sh")

if [[ -z "${PLATFORM_KEY}" || -z "${ZIP_PATH}" ]]; then
  echo "ERROR: failed to package sidecar OTA zip." >&2
  exit 1
fi

ARTIFACT_NAME="rushi-asr-sidecar-${PLATFORM_KEY}.zip"
MANIFEST_NAME="rushi-runtime-manifest-${PLATFORM_KEY}.json"
ARTIFACT_URL="https://github.com/${REPOSITORY}/releases/download/${TAG}/${ARTIFACT_NAME}"
MANIFEST_URL="https://github.com/${REPOSITORY}/releases/download/${TAG}/${MANIFEST_NAME}"

bash "${ROOT}/scripts/publish-runtime-manifest.sh" \
  --zip "${ZIP_PATH}" \
  --artifact-url "${ARTIFACT_URL}"

SIGNED_MANIFEST="${ROOT}/dist/runtime-manifest/rushi-runtime-manifest.json"
PLATFORM_MANIFEST="${ROOT}/dist/runtime-manifest/${MANIFEST_NAME}"
cp "${SIGNED_MANIFEST}" "${PLATFORM_MANIFEST}"

# Git Bash on Windows runners: keep forward-slash paths for gh upload.
ZIP_PATH="${ZIP_PATH//\\//}"
PLATFORM_MANIFEST="${PLATFORM_MANIFEST//\\//}"

echo "platform_key=${PLATFORM_KEY}"
echo "zip_path=${ZIP_PATH}"
echo "manifest_path=${PLATFORM_MANIFEST}"
echo "artifact_url=${ARTIFACT_URL}"
echo "manifest_url=${MANIFEST_URL}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "platform_key=${PLATFORM_KEY}"
    echo "zip_path=${ZIP_PATH}"
    echo "manifest_path=${PLATFORM_MANIFEST}"
    echo "artifact_url=${ARTIFACT_URL}"
    echo "manifest_url=${MANIFEST_URL}"
  } >> "${GITHUB_OUTPUT}"
fi

#!/usr/bin/env bash
# Upload macOS OTA artifacts to Cloudflare R2 (S3-compatible API).
# Requires: aws CLI v2, secrets R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET
set -euo pipefail

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> [--bundle-root PATH] [--cdn-base URL]" >&2
  exit 1
}

TAG=""
BUNDLE_ROOT="apps/desktop/src-tauri/target/release/bundle"
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
BUCKET="${R2_BUCKET:-rushi-updates}"

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --bundle-root)
      BUNDLE_ROOT="${2:-}"
      shift 2
      ;;
    --cdn-base)
      CDN_BASE="${2:-}"
      shift 2
      ;;
    --bucket)
      BUCKET="${2:-}"
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

if [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ] || [ -z "${R2_ENDPOINT:-}" ]; then
  echo "Missing R2 credentials. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT." >&2
  echo "Optional: R2_BUCKET (default: rushi-updates)." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required for R2 upload." >&2
  exit 1
fi

MACOS_DIR="${BUNDLE_ROOT}/macos"
TAR_GZ="${MACOS_DIR}/app.tar.gz"
SIG_FILE="${TAR_GZ}.sig"
LATEST_JSON="${MACOS_DIR}/latest.json"

for f in "$TAR_GZ" "$SIG_FILE" "$LATEST_JSON"; do
  if [ ! -f "$f" ]; then
    echo "Missing OTA artifact: $f" >&2
    exit 1
  fi
done

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${R2_REGION:-auto}"
# Avoid AWS_PROFILE / environment credential clash in CI.
export AWS_EC2_METADATA_DISABLED=true

S3=(aws --endpoint-url "$R2_ENDPOINT" s3)

echo "Uploading OTA to s3://${BUCKET}/ (CDN ${CDN_BASE})"
"${S3[@]}" cp "$TAR_GZ" "s3://${BUCKET}/${TAG}/app.tar.gz" --content-type application/gzip
"${S3[@]}" cp "$SIG_FILE" "s3://${BUCKET}/${TAG}/app.tar.gz.sig" --content-type text/plain
"${S3[@]}" cp "$LATEST_JSON" "s3://${BUCKET}/latest.json" --content-type application/json
# Keep a versioned copy of the manifest for debugging rollbacks.
"${S3[@]}" cp "$LATEST_JSON" "s3://${BUCKET}/${TAG}/latest.json" --content-type application/json

echo "CDN latest.json: ${CDN_BASE}/latest.json"
echo "CDN package:     ${CDN_BASE}/${TAG}/app.tar.gz"

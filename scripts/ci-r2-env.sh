#!/usr/bin/env bash
# Normalize R2 env for aws CLI. Must be sourced.
#
# Cloudflare bucket UI shows S3 API as:
#   https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>
# but aws --endpoint-url must be host-only (no bucket path):
#   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#
# shellcheck shell=bash
set -euo pipefail

if [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ] || [ -z "${R2_ENDPOINT:-}" ]; then
  echo "Missing R2 credentials. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT." >&2
  return 1 2>/dev/null || exit 1
fi

_R2_EP="${R2_ENDPOINT%%[[:space:]]*}"
_R2_EP="${_R2_EP%/}"

# Strip any path after host (Cloudflare UI copy-paste includes /bucket).
if [[ "${_R2_EP}" =~ ^(https://[^/?#]+) ]]; then
  _R2_HOST="${BASH_REMATCH[1]}"
  if [ "${_R2_EP}" != "${_R2_HOST}" ]; then
    echo "ci-r2-env: stripping path from R2_ENDPOINT (use host only; bucket goes in s3://BUCKET)." >&2
    echo "ci-r2-env: before=${_R2_EP}" >&2
    echo "ci-r2-env: after=${_R2_HOST}" >&2
  fi
  _R2_EP="${_R2_HOST}"
fi

if [[ ! "${_R2_EP}" =~ ^https://[a-zA-Z0-9.-]+\.r2\.cloudflarestorage\.com$ ]]; then
  echo "ci-r2-env: R2_ENDPOINT looks unexpected after normalize: ${_R2_EP}" >&2
  echo "ci-r2-env: expected https://<ACCOUNT_ID>.r2.cloudflarestorage.com" >&2
  return 1 2>/dev/null || exit 1
fi

export R2_ENDPOINT="${_R2_EP}"
export R2_BUCKET="${R2_BUCKET:-rushi-updates}"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${R2_REGION:-auto}"
export AWS_EC2_METADATA_DISABLED=true
export AWS_REQUEST_CHECKSUM_CALCULATION="${AWS_REQUEST_CHECKSUM_CALCULATION:-when_required}"
export AWS_RESPONSE_CHECKSUM_VALIDATION="${AWS_RESPONSE_CHECKSUM_VALIDATION:-when_required}"

unset _R2_EP _R2_HOST

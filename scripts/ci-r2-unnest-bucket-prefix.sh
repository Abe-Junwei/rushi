#!/usr/bin/env bash
# Fix objects uploaded when R2_ENDPOINT incorrectly included /<bucket>.
# Those land at s3://bucket/bucket/<key> instead of s3://bucket/<key>.
#
# Copies nested prefix → bucket root (server-side), then optionally deletes nested.
# Does not overwrite a newer root latest.json with an older nested copy.
#
# Usage:
#   source scripts/ci-r2-env.sh
#   bash scripts/ci-r2-unnest-bucket-prefix.sh [--delete-nested]
set -euo pipefail

DELETE_NESTED=false
while [ $# -gt 0 ]; do
  case "$1" in
    --delete-nested) DELETE_NESTED=true; shift ;;
    -h | --help)
      echo "Usage: $0 [--delete-nested]" >&2
      exit 1
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "${R2_ENDPOINT:-}" ] || [ -z "${R2_BUCKET:-}" ]; then
  # shellcheck source=scripts/ci-r2-env.sh
  source "$(cd "$(dirname "$0")" && pwd)/ci-r2-env.sh"
fi

NESTED_PREFIX="${R2_BUCKET}/"
SRC="s3://${R2_BUCKET}/${NESTED_PREFIX}"
DST="s3://${R2_BUCKET}/"
S3=(aws --endpoint-url "$R2_ENDPOINT" s3)

echo "Listing nested prefix: ${SRC}"
COUNT="$("${S3[@]}" ls "$SRC" --recursive 2>/dev/null | wc -l | tr -d ' ')"
if [ "${COUNT:-0}" = "0" ]; then
  echo "No nested objects under ${SRC} — nothing to unnest."
  exit 0
fi
echo "Found ${COUNT} nested object(s)."

# Prefer syncing known release trees so we do not clobber a correct root latest.json.
for sub in v1.0.0 runtime; do
  if "${S3[@]}" ls "${SRC}${sub}/" >/dev/null 2>&1; then
    echo "Sync ${SRC}${sub}/ → ${DST}${sub}/"
    "${S3[@]}" sync "${SRC}${sub}/" "${DST}${sub}/" --only-show-errors
  fi
done

# Also sync any other top-level keys under nested (except latest.json if root already has one).
if "${S3[@]}" ls "${DST}latest.json" >/dev/null 2>&1; then
  echo "Root latest.json already present — skipping nested latest.json overwrite."
  "${S3[@]}" sync "$SRC" "$DST" --exclude "latest.json" --only-show-errors
else
  echo "Sync full nested prefix → root (including latest.json)"
  "${S3[@]}" sync "$SRC" "$DST" --only-show-errors
fi

echo "Unnest sync complete."
echo "Root listing (sample):"
"${S3[@]}" ls "$DST" | head -30
echo "v1.0.0 listing (sample):"
"${S3[@]}" ls "${DST}v1.0.0/" 2>/dev/null | head -40 || true

if [ "$DELETE_NESTED" = true ]; then
  echo "Deleting nested prefix ${SRC}"
  "${S3[@]}" rm "$SRC" --recursive --only-show-errors
  echo "Nested prefix removed."
fi

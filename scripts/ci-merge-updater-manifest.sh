#!/usr/bin/env bash
# Merge per-platform updater fragments into one latest.json; optionally upload to R2 CDN.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  ci-merge-updater-manifest.sh --tag <vX.Y.Z> --fragment PATH [--fragment PATH ...]
    [--out PATH] [--cdn-base URL] [--upload] [--bucket NAME]

Each --fragment is a JSON file with a single entry under "platforms" (from
ci-generate-updater-latest-json.sh). All fragments must share the same version.
EOF
  exit 1
}

TAG=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
OUT=""
BUCKET="${R2_BUCKET:-rushi-updates}"
UPLOAD=false
FRAGMENTS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --fragment)
      FRAGMENTS+=("${2:-}")
      shift 2
      ;;
    --out)
      OUT="${2:-}"
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
    --upload)
      UPLOAD=true
      shift
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

if [ -z "$TAG" ] || [ ${#FRAGMENTS[@]} -eq 0 ]; then
  usage
fi

CDN_BASE="${CDN_BASE%/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "$OUT" ]; then
  OUT="${ROOT}/dist/updater/latest.json"
fi
mkdir -p "$(dirname "$OUT")"

MERGED_PLATFORMS="{}"
VERSION=""
NOTES=""
PUB_DATE=""

for fragment in "${FRAGMENTS[@]}"; do
  if [ ! -f "$fragment" ]; then
    echo "Missing updater fragment: $fragment" >&2
    exit 1
  fi
  frag_version="$(jq -r '.version // empty' "$fragment")"
  frag_notes="$(jq -r '.notes // empty' "$fragment")"
  frag_pub_date="$(jq -r '.pub_date // empty' "$fragment")"
  if [ -z "$frag_version" ]; then
    echo "Fragment missing version: $fragment" >&2
    exit 1
  fi
  if [ -z "$VERSION" ]; then
    VERSION="$frag_version"
    NOTES="$frag_notes"
    PUB_DATE="$frag_pub_date"
  elif [ "$frag_version" != "$VERSION" ]; then
    echo "Fragment version mismatch: $fragment has $frag_version, expected $VERSION" >&2
    exit 1
  fi
  platforms="$(jq -c '.platforms' "$fragment")"
  MERGED_PLATFORMS="$(jq -n --argjson a "$MERGED_PLATFORMS" --argjson b "$platforms" '$a * $b')"
done

jq -n \
  --arg version "$VERSION" \
  --arg notes "$NOTES" \
  --arg pub_date "$PUB_DATE" \
  --argjson platforms "$MERGED_PLATFORMS" \
  '{
    version: $version,
    notes: $notes,
    pub_date: $pub_date,
    platforms: $platforms
  }' > "$OUT"

echo "Wrote merged manifest: ${OUT}"
jq -r '.platforms | keys[]' "$OUT" | while read -r key; do
  echo "  platform: ${key}"
done

if [ "$UPLOAD" = false ]; then
  exit 0
fi

# shellcheck source=scripts/ci-r2-env.sh
source "$(cd "$(dirname "$0")" && pwd)/ci-r2-env.sh"
BUCKET="${BUCKET:-$R2_BUCKET}"
if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required for --upload." >&2
  exit 1
fi

S3=(aws --endpoint-url "$R2_ENDPOINT" s3)
"${S3[@]}" cp "$OUT" "s3://${BUCKET}/latest.json" --content-type application/json
"${S3[@]}" cp "$OUT" "s3://${BUCKET}/${TAG}/latest.json" --content-type application/json
echo "CDN latest.json: ${CDN_BASE}/latest.json"

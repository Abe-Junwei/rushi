#!/usr/bin/env bash
# Merge per-platform updater fragments into one latest.json; optionally upload to R2 CDN.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  ci-merge-updater-manifest.sh --tag <vX.Y.Z> --fragment PATH [--fragment PATH ...]
    [--out PATH] [--cdn-base URL] [--upload] [--bucket NAME] [--preserve-cdn]
    [--require-platforms csv]

Each --fragment is a JSON file with a single entry under "platforms" (from
ci-generate-updater-latest-json.sh). All fragments must share the same version.

--preserve-cdn: fetch existing CDN latest.json; for platforms missing from new
  fragments, keep the old entry only when old.version == new.version (same
  release re-run). Never keep a stale platform across a version bump.

--require-platforms: comma-separated Tauri keys that must exist with non-empty
  url+signature before --upload (industry gate: refuse partial latest.json).
  Example: darwin-aarch64,windows-x86_64
EOF
  exit 1
}

TAG=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
OUT=""
BUCKET="${R2_BUCKET:-rushi-updates}"
UPLOAD=false
PRESERVE_CDN=false
REQUIRE_PLATFORMS=""
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
    --preserve-cdn)
      PRESERVE_CDN=true
      shift
      ;;
    --require-platforms)
      REQUIRE_PLATFORMS="${2:-}"
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

if [ "$PRESERVE_CDN" = true ]; then
  PREV_JSON=""
  if PREV_JSON="$(curl -fsSL "${CDN_BASE}/latest.json" 2>/dev/null)"; then
    PREV_VERSION="$(echo "$PREV_JSON" | jq -r '.version // empty')"
    PREV_PLATFORMS="$(echo "$PREV_JSON" | jq -c '.platforms // {}')"
    if [ -n "$PREV_VERSION" ] && [ "$PREV_VERSION" = "$VERSION" ]; then
      # Same release: keep platforms not present in new fragments.
      MERGED_PLATFORMS="$(jq -n --argjson old "$PREV_PLATFORMS" --argjson new "$MERGED_PLATFORMS" '$old * $new')"
      echo "ci-merge: preserved CDN platforms for same version ${VERSION} (new fragments overlay)."
    elif [ -n "$PREV_VERSION" ]; then
      echo "::warning::ci-merge: CDN latest.json is ${PREV_VERSION}, new is ${VERSION} — not preserving old platforms (avoid stale OTA URLs)."
      # Warn about platforms that will disappear from latest.json this upload.
      while IFS= read -r p; do
        [ -z "$p" ] && continue
        if ! echo "$MERGED_PLATFORMS" | jq -e --arg p "$p" 'has($p)' >/dev/null; then
          echo "::warning::ci-merge: platform ${p} omitted in ${VERSION} (no fragment this run; was in ${PREV_VERSION})."
        fi
      done < <(echo "$PREV_PLATFORMS" | jq -r 'keys[]')
    fi
  else
    echo "ci-merge: no existing CDN latest.json to preserve (first publish or unreachable)."
  fi
fi

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

if [ -n "$REQUIRE_PLATFORMS" ]; then
  missing=""
  IFS=',' read -r -a req_list <<< "$REQUIRE_PLATFORMS"
  for p in "${req_list[@]}"; do
    p="$(echo "$p" | tr -d '[:space:]')"
    [ -z "$p" ] && continue
    url="$(jq -r --arg p "$p" '.platforms[$p].url // empty' "$OUT")"
    sig="$(jq -r --arg p "$p" '.platforms[$p].signature // empty' "$OUT")"
    if [ -z "$url" ] || [ -z "$sig" ]; then
      missing="${missing}${missing:+,}${p}"
    fi
  done
  if [ -n "$missing" ]; then
    echo "::error::Refusing to publish partial latest.json — missing/incomplete platforms: ${missing}" >&2
    echo "ci-merge: install CDN may still be published; leave previous latest.json untouched." >&2
    exit 2
  fi
  echo "ci-merge: require-platforms OK (${REQUIRE_PLATFORMS})"
fi

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

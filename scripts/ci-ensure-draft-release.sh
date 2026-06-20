#!/usr/bin/env bash
# Ensure a GitHub Release exists in draft state before CI uploads assets.
# Converts empty published releases back to draft so /releases/latest does not 404.
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

if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GH_TOKEN or GITHUB_TOKEN is required." >&2
  exit 1
fi

if ! gh release view "$TAG" >/dev/null 2>&1; then
  echo "Creating draft release ${TAG}..."
  gh release create "$TAG" --draft --title "$TAG" --generate-notes
  exit 0
fi

IS_DRAFT="$(gh release view "$TAG" --json isDraft -q .isDraft)"
ASSET_COUNT="$(gh release view "$TAG" --json assets -q '.assets | length')"

if [ "$IS_DRAFT" = "true" ]; then
  echo "Draft release ${TAG} ready for CI uploads."
  exit 0
fi

if [ "$ASSET_COUNT" = "0" ]; then
  echo "Published release ${TAG} has no assets — reverting to draft until CI finishes."
  gh release edit "$TAG" --draft=true
  exit 0
fi

echo "Release ${TAG} already published with ${ASSET_COUNT} asset(s); CI will upload with --clobber."

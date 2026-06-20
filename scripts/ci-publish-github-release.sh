#!/usr/bin/env bash
# Publish draft GitHub Release after all platform jobs uploaded assets.
set -euo pipefail

TAG=""

usage() {
  echo "Usage: $0 --tag <vX.Y.Z>" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
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

IS_DRAFT="$(gh release view "$TAG" --json isDraft -q .isDraft)"
if [ "$IS_DRAFT" = "true" ]; then
  gh release edit "$TAG" --draft=false
  echo "Published release ${TAG}."
else
  echo "Release ${TAG} already published."
fi

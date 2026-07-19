#!/usr/bin/env bash
# Resolve a short git SHA for build stamps / metadata. Never fails the caller.
# Usage:
#   source scripts/rushi-resolve-git-sha.sh
#   sha="$(rushi_resolve_git_sha)"
#   sha="$(rushi_resolve_git_sha /path/to/repo 7)"

rushi_resolve_git_sha() {
  local root="${1:-}"
  local length="${2:-7}"
  local raw=""

  if [ -n "${GITHUB_SHA:-}" ]; then
    raw="$GITHUB_SHA"
  elif [ -n "${RUSHI_GIT_SHA:-}" ]; then
    raw="$RUSHI_GIT_SHA"
  fi

  if [ -n "$raw" ]; then
    printf '%s\n' "${raw:0:length}"
    return 0
  fi

  if [ -z "$root" ]; then
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  fi

  if command -v git >/dev/null 2>&1; then
    raw="$(git -C "$root" rev-parse --short="$length" HEAD 2>/dev/null || true)"
    if [ -n "$raw" ]; then
      printf '%s\n' "$raw"
      return 0
    fi
  fi

  printf '%s\n' "unknown"
}

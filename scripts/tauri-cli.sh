#!/usr/bin/env bash
# Wrapper for @tauri-apps/cli: DMG builds need stale-mount cleanup and --skip-jenkins
# (via CI=true) on macOS 26+ where Finder AppleScript layout often fails bundle_dmg.sh.
# Without TAURI_SIGNING_PRIVATE_KEY, skip updater artifact signing (local .app/dmg still build).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_BIN="${ROOT}/node_modules/.bin/tauri"

tauri_build_wants_dmg() {
  local saw_build=0 saw_bundles=0 bundles_include_dmg=0 bundles_exclude_dmg=0
  local arg next="" i=0
  while [[ $# -gt 0 ]]; do
    arg="$1"
    shift
    case "${arg}" in
      build)
        saw_build=1
        ;;
      --bundles|-b)
        saw_bundles=1
        next="${1:-}"
        if [[ -z "${next}" || "${next}" == -* ]]; then
          echo "tauri-cli.sh: --bundles requires a value" >&2
          exit 1
        fi
        shift
        IFS=',' read -r -a parts <<< "${next}"
        for part in "${parts[@]}"; do
          part="${part#"${part%%[![:space:]]*}"}"
          part="${part%"${part##*[![:space:]]}"}"
          if [[ "${part}" == "dmg" ]]; then
            bundles_include_dmg=1
          elif [[ -n "${part}" ]]; then
            bundles_exclude_dmg=1
          fi
        done
        ;;
    esac
  done

  [[ "${saw_build}" -eq 1 ]] || return 1
  if [[ "${saw_bundles}" -eq 1 ]]; then
    [[ "${bundles_include_dmg}" -eq 1 ]]
    return
  fi
  # Default bundle targets from tauri.conf.json include dmg.
  return 0
}

tauri_args_include_build() {
  local arg
  for arg in "$@"; do
    if [[ "${arg}" == "build" ]]; then
      return 0
    fi
  done
  return 1
}

if tauri_build_wants_dmg "$@"; then
  bash "${ROOT}/scripts/release-cleanup-dmg-staging.sh"
  export CI="${CI:-true}"
fi

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && "${RUSHI_REQUIRE_UPDATER_ARTIFACTS:-0}" != "1" ]] \
  && tauri_args_include_build "$@"; then
  echo "tauri-cli.sh: TAURI_SIGNING_PRIVATE_KEY unset — building with createUpdaterArtifacts=false (local hand-test)." >&2
  echo "tauri-cli.sh: For OTA release artifacts, export TAURI_SIGNING_PRIVATE_KEY (+ optional PASSWORD)." >&2
  exec "${TAURI_BIN}" "$@" --config '{"bundle":{"createUpdaterArtifacts":false}}'
fi

exec "${TAURI_BIN}" "$@"

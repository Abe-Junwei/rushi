#!/usr/bin/env bash
# Detach stale create-dmg mounts and remove rw.*.dmg intermediates (~1GB each).
# Interrupted `tauri build --bundles dmg` often leaves these mounted and breaks bundle_dmg.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MACOS_BUNDLE="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos"
DMG_BUNDLE="${ROOT}/apps/desktop/src-tauri/target/release/bundle/dmg"

detach_stale_mounts() {
  command -v hdiutil >/dev/null 2>&1 || return 0

  local img="" mount="" line
  while IFS= read -r line; do
    case "${line}" in
      image-path*:*)
        img="${line#*: }"
        img="${img#"${img%%[![:space:]]*}"}"
        ;;
      /dev/*"/Volumes/dmg."*)
        mount="${line##*$'\t'}"
        if [[ -n "${img}" && "${img}" == *"${ROOT}"*"/apps/desktop/src-tauri/target/release/bundle/"* ]]; then
          echo "detach stale DMG mount: ${mount} (${img})"
          hdiutil detach "${mount}" -force 2>/dev/null || hdiutil detach "${img}" -force 2>/dev/null || true
        fi
        ;;
    esac
  done < <(hdiutil info 2>/dev/null || true)

  local rw dir
  for dir in "${MACOS_BUNDLE}" "${DMG_BUNDLE}"; do
    [[ -d "${dir}" ]] || continue
    shopt -s nullglob
    for rw in "${dir}"/rw.*.dmg; do
      echo "detach stale rw image: ${rw}"
      hdiutil detach "${rw}" -force 2>/dev/null || true
    done
    shopt -u nullglob
  done
}

remove_rw_files() {
  local dir removed=0 f
  for dir in "${MACOS_BUNDLE}" "${DMG_BUNDLE}"; do
    [[ -d "${dir}" ]] || continue
    shopt -s nullglob
    for f in "${dir}"/rw.*.dmg; do
      echo "remove stale DMG staging: ${f}"
      rm -f "${f}"
      removed=$((removed + 1))
    done
    shopt -u nullglob
  done
  if [[ "${removed}" -eq 0 ]]; then
    echo "no rw.*.dmg staging files to clean"
  else
    echo "cleaned ${removed} rw.*.dmg staging file(s)"
  fi
}

detach_stale_mounts
remove_rw_files

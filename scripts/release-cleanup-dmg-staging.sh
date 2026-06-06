#!/usr/bin/env bash
# Remove stale hdiutil rw.*.dmg intermediates before DMG bundling (~1GB each).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MACOS_BUNDLE="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos"
DMG_BUNDLE="${ROOT}/apps/desktop/src-tauri/target/release/bundle/dmg"

removed=0
for dir in "${MACOS_BUNDLE}" "${DMG_BUNDLE}"; do
  [[ -d "${dir}" ]] || continue
  while IFS= read -r -d '' f; do
    echo "remove stale DMG staging: ${f}"
    rm -f "${f}"
    removed=$((removed + 1))
  done < <(find "${dir}" -maxdepth 1 -name 'rw.*.dmg' -print0 2>/dev/null || true)
done

if [[ "${removed}" -eq 0 ]]; then
  echo "no rw.*.dmg staging files to clean"
else
  echo "cleaned ${removed} rw.*.dmg staging file(s)"
fi

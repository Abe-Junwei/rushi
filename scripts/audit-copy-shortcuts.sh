#!/usr/bin/env bash
# Phase 7-A: grep hardcoded shortcut glyphs in UI (should use editorShortcutRegistry / hints).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/apps/desktop/src"

ALLOWLIST=(
  "utils/editorShortcutRegistry.ts"
  "utils/editorShortcutMenuHint.ts"
  "utils/editorFooterShortcutHints"
  "utils/dialogPanelHints.ts"
  "utils/formatEditorShortcutPanelSections.ts"
  "components/EnvEditorShortcutsPanel"
  "FindReplaceDialog.tsx"
  "WaveformSegmentOverlay.tsx"
  "GlossaryBulkAddDialog.tsx"
  "pages/ProjectLifecycleApi.ts"
)

echo "=== audit-copy-shortcuts: hardcoded ⌘ / Ctrl+ in components ==="
hits=0
while IFS= read -r file; do
  skip=0
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      skip=1
      break
    fi
  done
  [[ "$skip" -eq 1 ]] && continue
  if [[ "$file" == *.test.ts ]] || [[ "$file" == *.test.tsx ]]; then
    continue
  fi
  if rg -n '⌘|Ctrl\+' "$file" >/dev/null 2>&1; then
    echo "--- $file"
    rg -n '⌘|Ctrl\+' "$file" || true
    hits=$((hits + 1))
  fi
done < <(find "$DESKTOP/components" "$DESKTOP/pages" -type f \( -name '*.tsx' -o -name '*.ts' \) 2>/dev/null | sort)

if [[ "$hits" -eq 0 ]]; then
  echo "OK: no hardcoded shortcut glyphs in scanned UI paths (allowlist excluded)."
  exit 0
fi

echo ""
echo "Found $hits file(s) with hardcoded shortcuts — review for registry alignment."
exit 1

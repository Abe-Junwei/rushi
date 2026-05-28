#!/usr/bin/env bash
# Remove regenerable build/cache artifacts for Rushi (and optional sibling repos).
# Does NOT remove: node_modules, main Python .venv, .jieyu-models, bundled-asr sidecar binaries.
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
SIBLING_ROOT="${2:-$(dirname "$ROOT")}"

clean_one() {
  local repo="$1"
  local name
  name="$(basename "$repo")"
  echo "==> $name ($repo)"

  rm -rf \
    "$repo/apps/desktop/src-tauri/target" \
    "$repo/apps/desktop/dist" \
    "$repo/apps/desktop/src-tauri/gen" \
    "$repo/apps/desktop/test-results" \
    "$repo/apps/erya-desktop/src-tauri/target" \
    "$repo/apps/erya-desktop/dist" \
    "$repo/apps/erya-desktop/src-tauri/gen" \
    "$repo/target" \
    "$repo/dist" \
    "$repo/services/asr/dist" \
    "$repo/services/asr/build" \
    "$repo/services/asr/.pytest_cache" \
    "$repo/services/asr/.venv-sidecar-build" \
    "$repo/services/asr/.venv-sidecar-build-cuda" \
    "$repo/services/asr/.venv-lockgen-cpu" \
    "$repo/fixtures/local-runtime" \
    "$repo/.playwright-mcp" \
    "$repo/test-results" \
    "$repo/.tmp" \
    2>/dev/null || true

  rm -f "$repo/reports/code-scale/latest.json" 2>/dev/null || true
  rm -f "$repo"/reports/code-scale/baseline-*.json 2>/dev/null || true
  find "$repo" -name .DS_Store -delete 2>/dev/null || true
  if [ -d "$repo/services/asr" ]; then
    find "$repo/services/asr" -path '*/.venv*' -prune -o -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null || true
  fi

  du -sh "$repo" 2>/dev/null || true
}

if [ -d "$ROOT/.git" ] && [ -f "$ROOT/package.json" ]; then
  clean_one "$ROOT"
fi

for s in Erya Jieyu Rushi; do
  d="$SIBLING_ROOT/$s"
  if [ -d "$d/.git" ] && [ "$(cd "$d" && pwd)" != "$(cd "$ROOT" && pwd)" ]; then
    clean_one "$d"
  fi
done

echo "Done. Rebuild hints:"
echo "  Rushi: npm install && npm run desktop:dev"
echo "  Rushi ASR sidecar venv: bash scripts/bootstrap-asr-venv.sh"
echo "  Erya/Jieyu: npm install && respective dev scripts"

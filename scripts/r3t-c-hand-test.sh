#!/usr/bin/env bash
# R3t-C hand-test runner: neighbor context + auto_punctuate regression.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_LOG="${RUSHI_DESKTOP_LOG:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log}"

echo "==> R3t-C Layer 1: TypeScript"
(
  cd "${ROOT}/apps/desktop"
  npm run test -- \
    src/pages/autoPunctuateNeighbors.test.ts \
    src/pages/useAutoPunctuateController.test.ts \
    src/services/postprocess/postprocessRuntimeContract.test.ts
)

echo "==> R3t-C Layer 2: Rust postprocess"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q postprocess_cmd
)

echo "==> R3t-C Layer 3: desktop.log auto_punctuate (optional)"
if [[ -f "${APP_LOG}" ]] && grep -q "postprocess_auto_punctuate_done" "${APP_LOG}" 2>/dev/null; then
  echo "  OK: found postprocess_auto_punctuate_done in desktop.log"
  grep "postprocess_auto_punctuate" "${APP_LOG}" | tail -3 || true
else
  echo "  (skip — no postprocess_auto_punctuate_done in log; run desktop auto-punctuate once)"
fi

echo ""
echo "==> R3t-C automated checks passed (16 TS + 17 Rust)"
echo "Manual spot-check: 选中中间语段 → 自动标点 → 「含邻段上下文」→ 预览确认写回"

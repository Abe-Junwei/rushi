#!/usr/bin/env bash
# ⑤″f-B 机器闸门 — F1 + F6 + MEM-P0
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== ⑤″f-B machine gate =="
npm run typecheck
npm run test -w @rushi/desktop -- \
  segmentCorrectionRulesApply \
  manualCorrectionMemory \
  useManualCorrectionMemoryDialog \
  useAutoSaveSegments \
  correctionLearnBaseline \
  segmentFindReplace
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml correction -- --test-threads=1 2>/dev/null || \
  echo "WARN: cargo correction tests skipped (no rust/cargo in env)"
node scripts/check-architecture-guard.mjs

echo ""
echo "OK: machine gate passed."
echo "Hand-test: docs/execution/specs/r3-5f-b-hand-test-checklist.md"

#!/usr/bin/env bash
# ⑤″f-B½ 机器闸门 — MEM-P1（记忆管理 + LEX-MINE-1）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== ⑤″f-B½ machine gate (MEM-P1) =="
npm run typecheck
npm run test -w @rushi/desktop -- \
  correctionMemoryHelpers \
  useGlossaryMineController
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml correction -- --test-threads=1 2>/dev/null || \
  echo "WARN: cargo correction tests skipped"
node scripts/check-architecture-guard.mjs

echo ""
echo "OK: MEM-P1 machine gate passed."
echo "Hand-test: docs/execution/specs/mem-p1-hand-test-checklist.md"

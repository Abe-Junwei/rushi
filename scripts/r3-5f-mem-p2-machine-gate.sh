#!/usr/bin/env bash
# ⑤″f-C MEM-P2 机器闸门 — uid 对齐学习 + ACC-TXT-0 spike
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== ⑤″f-C MEM-P2 machine gate =="
npm run typecheck
npm run test -w @rushi/desktop -- \
  correctionLearnBaseline \
  segmentCorrectionRulesApply
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml correction -- --test-threads=1
node scripts/check-architecture-guard.mjs

echo ""
echo "OK: MEM-P2 machine gate passed."
echo "Hand-test: docs/execution/specs/mem-p2-hand-test-checklist.md"

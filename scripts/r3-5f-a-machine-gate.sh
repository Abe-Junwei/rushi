#!/usr/bin/env bash
# ⑤″f-A 机器闸门 — F2 查找替换（编码签收，非 UI 手测）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== ⑤″f-A machine gate =="
npm run typecheck
npm run test -w @rushi/desktop -- segmentFindReplace
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml lexicon_pack
node scripts/check-architecture-guard.mjs

echo ""
echo "OK: machine gate passed."
echo "Next: UI hand-test — docs/execution/specs/f2-hand-test-checklist.md"

#!/usr/bin/env bash
# REV-LOC 切片 A — 机器可重复部分（手测三条见 docs/execution/specs/rev-loc-slice-a-hand-test-checklist.md）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== REV-LOC A machine gate =="
npm run typecheck
npm run test -w @rushi/desktop -- --run flushSegmentTextDrafts useSegmentMutationController
node scripts/check-architecture-guard.mjs

echo "== REV-LOC A Rust segment save =="
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml file_save_segments --

echo "OK: REV-LOC slice A machine evidence passed. Complete §1–§3 in desktop per rev-loc-slice-a-hand-test-checklist.md"

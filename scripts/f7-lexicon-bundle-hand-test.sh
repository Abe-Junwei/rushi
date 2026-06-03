#!/usr/bin/env bash
# F7 词表包手测 — 机器可重复部分（见 docs/execution/specs/f7-lexicon-bundle-hand-test-checklist.md）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== F7 machine gate =="
npm run typecheck
npm run test -w @rushi/desktop
node scripts/check-architecture-guard.mjs

echo "== F7 Rust exchange + project bundle isolation =="
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml f7_hand_test_ab_exchange --
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml project_bundle_zip_excludes_lexicon_bundle --

echo "OK: F7 automated hand-test evidence passed. Complete §A–§D in desktop UI per f7-lexicon-bundle-hand-test-checklist.md"

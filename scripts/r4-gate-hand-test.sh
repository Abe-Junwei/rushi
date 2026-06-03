#!/usr/bin/env bash
# R4 + R4-GATE — 机器可重复部分（桌面 UI 手测：欢迎页 → 质量概览）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== R4 machine gate =="
npm run typecheck
npm run test -w @rushi/desktop -- --run src/services/quality
node scripts/check-architecture-guard.mjs

echo "== R4 Rust quality_eval =="
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml quality_eval -- --nocapture

echo "== R4 eval-run --output CLI =="
python3 scripts/eval-run.py --help | grep -q -- '--output'

echo "OK: R4 machine evidence passed. Hand-test: Welcome → 质量概览 → R4-GATE（制控专名）"

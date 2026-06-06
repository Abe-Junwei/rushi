#!/usr/bin/env bash
# R3h-0 机器闸门 — bundled sidecar smoke + asr_setup diagnose + pip UI regression
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== R3h-0 machine gate =="

echo "-- bundled sidecar post-build smoke --"
bash scripts/smoke-asr-sidecar-health.sh

echo "-- asr_setup diagnose (sidecarIntegrity) --"
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml asr_setup -- --test-threads=1

echo "-- pip advanced UI regression --"
npm run test -w @rushi/desktop -- LocalAsrAdvancedSection

echo "-- architecture guard --"
node scripts/check-architecture-guard.mjs

echo ""
echo "OK: R3h-0 machine gate passed."
echo "Hand-test: docs/execution/specs/r3h-0-hand-test-checklist.md (Win §4 still pending)"

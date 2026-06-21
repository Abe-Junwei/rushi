#!/usr/bin/env bash
# R3h-2 C-class auto rollback — revalidate-path integration test (fake sidecars).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/apps/desktop/src-tauri/target}"
export CARGO_TARGET_DIR="$TARGET_DIR"

echo "==> cargo test C-class auto rollback (revalidate → restore previous)"
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml \
  c_class_auto_rollback_revalidate_restores_previous -- --nocapture

echo "OK: C-class auto rollback integration test passed"
echo "Optional: runtime manifest / 0.2.0 corrupt upgrade UI hand test no longer applies (v0.1.8 Plan B)"

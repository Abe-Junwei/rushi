#!/usr/bin/env bash
# REV-LOC 切片 B — 机器回归（UI 手测见 docs/execution/specs/rev-loc-slice-b-hand-test-checklist.md）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run typecheck
npm run test -w @rushi/desktop
node scripts/check-architecture-guard.mjs
(cd apps/desktop/src-tauri && cargo test edit_log)
echo "OK: REV-LOC slice B machine checks passed."

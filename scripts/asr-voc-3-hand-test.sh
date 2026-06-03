#!/usr/bin/env bash
# ASR-VOC-3 — 机器回归（在线 E2E 见 docs/execution/specs/asr-voc-3-hand-test-checklist.md）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run typecheck
npm run test -w @rushi/desktop
node scripts/check-architecture-guard.mjs
(
  cd apps/desktop/src-tauri
  cargo test -q stt_vocabulary
  cargo test -q glossary_hotwords::tests
)
echo "OK: ASR-VOC-3 machine checks passed."

#!/usr/bin/env bash
# TRN-DIAG hand-test runner: transcribe timeline + diagnostic export contract.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> TRN-DIAG Layer 1: Rust transcribe_timeline"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q transcribe_timeline
)

echo "==> TRN-DIAG Layer 2: TS transcribeDiag"
(
  cd "${ROOT}/apps/desktop"
  npm run test -- src/services/transcribeDiag.test.ts
)

echo "==> TRN-DIAG Layer 3: last timeline file (optional)"
APP_ROOT="${RUSHI_APP_DATA:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi}"
TL="${APP_ROOT}/transcribe_timeline_last.json"
if [[ -f "${TL}" ]]; then
  if grep -q '"transcribe_timeline"' "${TL}"; then
    echo "  found transcribe_timeline_last.json with transcribe_timeline[]"
  else
    echo "  WARN: timeline file missing transcribe_timeline key"
    exit 1
  fi
else
  echo "  (skip — no transcribe_timeline_last.json yet; run one transcribe first)"
fi

echo ""
echo "==> TRN-DIAG automated checks passed"
echo "Manual: stop sidecar → transcribe → UI banner shows stage; export diagnostic includes transcribe_timeline.json"

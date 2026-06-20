#!/usr/bin/env bash
# Phase C/D machine gate before manual hand-test (asr-model-download-status remediation).
# Usage: bash scripts/asr-model-download-phase-cd-hand-test.sh [--with-loopback]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WITH_LOOPBACK=0
for arg in "$@"; do
  case "$arg" in
    --with-loopback) WITH_LOOPBACK=1 ;;
  esac
done

echo "== Phase C/D machine gate =="

cd "${ROOT}"
npm run typecheck
node scripts/check-architecture-guard.mjs

cd "${ROOT}/apps/desktop"
npx vitest run \
  src/services/asr/prepareJobPresentation.test.ts \
  src/services/asr/asrCatalogPresentation.test.ts \
  src/pages/asrSetupState.test.ts \
  src/services/asr/asrEnvStatus.test.ts \
  src/pages/usePrepareModelController.test.ts

cd "${ROOT}/apps/desktop/src-tauri"
cargo test artifact_job --quiet
cargo test apply_prepare_status --quiet
cargo test launch_report --quiet

if [[ "${WITH_LOOPBACK}" -eq 1 ]]; then
  BASE="http://127.0.0.1:8741"
  echo "== Optional loopback snapshot =="
  if curl -sf --max-time 3 "${BASE}/health" >/dev/null; then
    echo "health: ok"
    curl -sf --max-time 3 "${BASE}/v1/models/prepare-status" | head -c 400 || true
    echo ""
  else
    echo "WARN: loopback :8741 not reachable; skip live prepare-status (start sidecar for full hand-test)"
  fi
fi

echo ""
echo "OK: Phase C/D machine gate passed."
echo "Next: docs/execution/specs/asr-model-download-status-phase-cd-hand-test-checklist.md"

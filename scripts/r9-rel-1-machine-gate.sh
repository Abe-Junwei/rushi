#!/usr/bin/env bash
# R9 REL-1 — 机器可重复门禁（手测见 docs/execution/specs/r9-rel-1-personal-v1-acceptance.md）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== R9 machine gate =="
npm run typecheck
npm run test -w @rushi/desktop
node scripts/check-architecture-guard.mjs

echo "== R9 R4-GATE evidence =="
bash scripts/r4-gate-hand-test.sh

echo "== R9 ASR health (optional if desktop:dev running) =="
if curl -sf --max-time 3 http://127.0.0.1:8741/health >/dev/null 2>&1; then
  echo "ASR 8741: reachable"
else
  echo "SKIP: ASR not on 8741 (start with npm run desktop:dev for hand tests)"
fi

echo "OK: R9 machine gate passed. Complete A–E hand checklist in r9-rel-1-personal-v1-acceptance.md"

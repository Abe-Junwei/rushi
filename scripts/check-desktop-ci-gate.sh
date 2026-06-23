#!/usr/bin/env bash
# Mirrors .github/workflows/ci.yml `desktop` job (single source of truth for local pre-push).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== desktop CI gate: lint =="
npm run lint -w @rushi/desktop

echo "== desktop CI gate: typecheck =="
npm run typecheck -w @rushi/desktop

echo "== desktop CI gate: test:coverage =="
npm run test:coverage -w @rushi/desktop

echo "== desktop CI gate: test:perf (CI=${CI:-}) =="
npm run test:perf -w @rushi/desktop

echo "== desktop CI gate: build =="
npm run build -w @rushi/desktop

echo "== desktop CI gate: architecture guard =="
node scripts/check-architecture-guard.mjs

echo "desktop CI gate: all passed"

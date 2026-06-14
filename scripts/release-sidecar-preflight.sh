#!/usr/bin/env bash
# Release gate: bundled sidecar must exist and pass post-build smoke.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="${ROOT}/apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar"

echo "== release sidecar preflight =="

if [[ ! -x "${SIDECAR}" ]]; then
  echo "FAIL: bundled sidecar missing or not executable:" >&2
  echo "  ${SIDECAR}" >&2
  echo "Run: npm run asr:build-sidecar-unix" >&2
  exit 1
fi

INTERNAL="$(dirname "${SIDECAR}")/_internal/funasr/version.txt"
if [[ ! -f "${INTERNAL}" ]]; then
  echo "FAIL: missing ${INTERNAL}" >&2
  echo "Rebuild sidecar so funasr package data lands in _internal/" >&2
  exit 1
fi

STAMP="$(dirname "${SIDECAR}")/sidecar-build-stamp.txt"
if [[ ! -s "${STAMP}" ]]; then
  echo "FAIL: missing sidecar build stamp: ${STAMP}" >&2
  echo "Run: npm run asr:build-sidecar-unix" >&2
  exit 1
fi
echo "  sidecar stamp: $(tr '\n' ' ' < "${STAMP}" | sed 's/[[:space:]]*$//')"

bash "${ROOT}/scripts/smoke-asr-sidecar-health.sh"
echo "OK: release sidecar preflight passed."

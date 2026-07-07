#!/usr/bin/env bash
# Release gate: bundled sidecar must exist and pass post-build smoke.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="${ROOT}/apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar"

if [[ "${RUSHI_SKIP_SIDECAR_CHECK:-0}" -eq 1 ]]; then
  echo "== release sidecar preflight =="
  echo "  SKIP: RUSHI_SKIP_SIDECAR_CHECK=1 (reuse local bundled-asr; no file or smoke gate)"
  exit 0
fi

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

if [[ "${RUSHI_SKIP_SIDECAR_SMOKE:-0}" -eq 1 ]]; then
  echo "  SKIP: RUSHI_SKIP_SIDECAR_SMOKE=1 (local sidecar present; no /health smoke)"
  echo "OK: release sidecar preflight passed (files only)."
  exit 0
fi

bash "${ROOT}/scripts/smoke-asr-sidecar-health.sh"
echo "OK: release sidecar preflight passed."

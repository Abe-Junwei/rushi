#!/usr/bin/env bash
# Resolve services/asr/.venv Python (Unix or Windows Git Bash / MSYS).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${ROOT}/services/asr/.venv"
for candidate in \
  "${VENV}/Scripts/python.exe" \
  "${VENV}/bin/python3" \
  "${VENV}/bin/python"; do
  if [[ -x "${candidate}" ]] || [[ -f "${candidate}" ]]; then
    echo "${candidate}"
    exit 0
  fi
done
echo "ASR venv python not found — run: bash scripts/bootstrap-asr-venv.sh" >&2
exit 1

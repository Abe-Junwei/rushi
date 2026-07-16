#!/usr/bin/env bash
# Install pip package(s) into an isolated CI venv and prepend its bin to PATH.
# Safe on Homebrew / PEP 668 "externally-managed-environment" runners (macOS).
#
# Must be sourced so PATH updates apply to later commands in the same step:
#   # shellcheck source=scripts/ci-pip-venv-install.sh
#   source scripts/ci-pip-venv-install.sh awscli
#   source scripts/ci-pip-venv-install.sh cryptography
#
# Also appends venv bin to $GITHUB_PATH when set (subsequent Actions steps).
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: source $0 <pip-package> [more-packages...]" >&2
  return 1 2>/dev/null || exit 1
fi

_SCRIPT="${BASH_SOURCE[0]:-${0}}"
_ROOT="$(cd "$(dirname "${_SCRIPT}")/.." && pwd)"
_VENV="${CI_TOOLS_VENV:-${_ROOT}/.venv-ci-tools}"

_PY=""
if command -v python3 >/dev/null 2>&1; then
  _PY=python3
elif command -v python >/dev/null 2>&1; then
  _PY=python
else
  echo "python3/python not found" >&2
  return 1 2>/dev/null || exit 1
fi

if [ ! -x "${_VENV}/bin/python" ] && [ ! -x "${_VENV}/Scripts/python.exe" ]; then
  "${_PY}" -m venv "${_VENV}"
fi

if [ -x "${_VENV}/bin/python" ]; then
  _VENV_PY="${_VENV}/bin/python"
  _VENV_BIN="${_VENV}/bin"
else
  _VENV_PY="${_VENV}/Scripts/python.exe"
  _VENV_BIN="${_VENV}/Scripts"
fi

"${_VENV_PY}" -m pip install -U pip "$@"
export PATH="${_VENV_BIN}:${PATH}"
if [ -n "${GITHUB_PATH:-}" ]; then
  echo "${_VENV_BIN}" >>"${GITHUB_PATH}"
fi
echo "ci-pip-venv-install: PATH+=${_VENV_BIN} packages=$*" >&2
unset _ROOT _VENV _PY _VENV_PY _VENV_BIN

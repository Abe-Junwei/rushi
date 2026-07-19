#!/usr/bin/env bash
# Resolve a usable host Python 3.12 (pip + venv). Prefer Rushi self-hosted/dev path.
set -euo pipefail

is_usable() {
  local py="$1"
  [[ -n "$py" && -f "$py" ]] || return 1
  "$py" -c "import sys,pip,venv; assert sys.version_info[:2]==(3,12)" 2>/dev/null
}

candidates=()
if [[ -n "${RUSHI_HOST_PYTHON:-}" ]]; then
  candidates+=("${RUSHI_HOST_PYTHON}")
fi
candidates+=(
  "/e/Python312/python.exe"
  "E:/Python312/python.exe"
  "/c/Program Files/Python312/python.exe"
  "${LOCALAPPDATA:-}/Programs/Python/Python312/python.exe"
)

for c in "${candidates[@]}"; do
  if is_usable "$c"; then
    echo "$c"
    exit 0
  fi
done

# py launcher (Astral/uv or python.org)
if command -v py >/dev/null 2>&1; then
  for spec in "-3.12" "-V:Astral/CPython3.12.10"; do
    out="$(py $spec -c "import sys; print(sys.executable)" 2>/dev/null || true)"
    if is_usable "${out}"; then
      echo "${out}"
      exit 0
    fi
  done
fi

for cmd in python3.12 python3 python; do
  if command -v "$cmd" >/dev/null 2>&1; then
    resolved="$(command -v "$cmd")"
    if is_usable "$resolved"; then
      echo "$resolved"
      exit 0
    fi
  fi
done

echo "No usable Python 3.12 with pip+venv. Prefer E:\\Python312 (uv) or set RUSHI_HOST_PYTHON." >&2
exit 1

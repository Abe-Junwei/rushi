#!/usr/bin/env bash
# Dev desktop: source ASR on 8741 + skip PyInstaller bundled sidecar (always current Python code).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"

# Windows: Microsoft Store / WSL `bash` breaks this flow (wrong venv layout, Tauri host).
# Prefer Git Bash on PATH (e.g. E:\Git\bin before WindowsApps).
if [[ -n "${WSL_DISTRO_NAME:-}" ]] || grep -qiE '(Microsoft|WSL)' /proc/version 2>/dev/null; then
  echo "FAIL: desktop:dev is running under WSL bash." >&2
  echo "      On Windows, use Git Bash — put its bin dir ahead of WindowsApps on PATH," >&2
  echo "      e.g. E:\\Git\\bin before %LOCALAPPDATA%\\Microsoft\\WindowsApps." >&2
  exit 1
fi

ASR_DIR="$ROOT/services/asr"
VENV_PY=""
ASR_BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
ASR_PID=""
STARTED_ASR=0

resolve_venv_py() {
  # Unix .venv/bin/python or Windows .venv/Scripts/python.exe (Git Bash / MSYS).
  bash "${ROOT}/scripts/resolve-asr-venv-python.sh"
}

cleanup() {
  if [[ "$STARTED_ASR" == "1" && -n "$ASR_PID" ]]; then
    kill "$ASR_PID" 2>/dev/null || true
    wait "$ASR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Prefer node over python3 — Git Bash on Windows often has no python3 on PATH.
sidecar_looks_current() {
  curl -sf --max-time 2 "${ASR_BASE}/" 2>/dev/null | node -e '
let j; try { j = JSON.parse(require("fs").readFileSync(0, "utf8")); } catch { process.exit(1); }
process.exit(String(j.prepare_cancel || "").includes("prepare-cancel") ? 0 : 1);
' 2>/dev/null
}

health_models_root_matches() {
  export_asr_model_env
  local expected="${RUSHI_MODELS_ROOT:-}"
  [[ -n "${expected}" ]] || return 1
  # Env must bind to `node` (right side of pipe), not only `curl`.
  curl -sf --max-time 2 "${ASR_BASE}/health" 2>/dev/null | RUSHI_MODELS_ROOT_EXPECT="${expected}" node -e '
let j; try { j = JSON.parse(require("fs").readFileSync(0, "utf8")); } catch { process.exit(1); }
const norm = (s) => String(s || "").replace(/\\/g, "/").replace(/\/+$/, "");
const root = norm(j.rushi_models_root);
const exp = norm(process.env.RUSHI_MODELS_ROOT_EXPECT);
process.exit(root && exp && root === exp ? 0 : 1);
' 2>/dev/null
}

health_local_token_required() {
  curl -sf --max-time 2 "${ASR_BASE}/health" 2>/dev/null | node -e '
let j; try { j = JSON.parse(require("fs").readFileSync(0, "utf8")); } catch { process.exit(1); }
process.exit(j.local_token_required === true ? 0 : 1);
' 2>/dev/null
}

# curl -sf succeeds only when /health returns JSON quickly (detects hung listeners on :8741).
asr_health_reachable() {
  curl -sf --max-time 2 "${ASR_BASE}/health" >/dev/null 2>&1
}

stop_sidecar_on_8741() {
  local pids
  pids="$(lsof -ti :8741 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "==> Stopping process on 8741 (${pids})…"
    kill ${pids} 2>/dev/null || true
    sleep 1
  fi
}

ensure_venv() {
  if VENV_PY="$(resolve_venv_py 2>/dev/null)"; then
    return 0
  fi
  echo "==> Creating services/asr/.venv (first run)…"
  bash "$ROOT/scripts/bootstrap-asr-venv.sh"
  VENV_PY="$(resolve_venv_py)"
}

ensure_funasr() {
  if "$VENV_PY" -c "import funasr" 2>/dev/null; then
    return 0
  fi
  echo "==> Installing FunASR into ASR venv (one-time)…"
  (cd "$ASR_DIR" && "$VENV_PY" -m pip install -q -e ".[funasr]")
}

start_source_sidecar() {
  ensure_venv
  ensure_funasr
  export_asr_model_env
  echo "==> Starting rushi-asr from source on ${ASR_BASE}…"
  echo "    RUSHI_MODELS_ROOT=${RUSHI_MODELS_ROOT}"
  "$VENV_PY" -m rushi_asr >>"${TMPDIR:-/tmp}/rushi-asr-dev.log" 2>&1 &
  ASR_PID=$!
  STARTED_ASR=1
  for _ in $(seq 1 120); do
    if asr_health_reachable; then
      echo "==> ASR ready (log: ${TMPDIR:-/tmp}/rushi-asr-dev.log)"
      return 0
    fi
    sleep 0.5
  done
  echo "FAIL: ASR did not become healthy within 60s. See ${TMPDIR:-/tmp}/rushi-asr-dev.log" >&2
  echo "      If :8741 is stuck: lsof -ti :8741 | xargs kill -9" >&2
  exit 1
}

if asr_health_reachable; then
  if sidecar_looks_current; then
    if health_models_root_matches && ! health_local_token_required; then
      export_asr_model_env
      echo "==> Using existing ASR on 8741 (models: ${RUSHI_MODELS_ROOT})"
    elif health_local_token_required; then
      echo "==> 8741 ASR requires RUSHI_LOCAL_TOKEN (leftover bundled sidecar) — restarting source ASR without token…"
      stop_sidecar_on_8741
      start_source_sidecar
    else
      echo "==> 8741 ASR is up but not using app model cache — restarting with RUSHI_MODELS_ROOT…"
      stop_sidecar_on_8741
      start_source_sidecar
    fi
  else
    echo "FAIL: 8741 is in use but the process looks like an old bundled sidecar." >&2
    echo "      Stop it and re-run: npm run desktop:dev:release" >&2
    echo "      macOS:  lsof -ti :8741 | xargs kill -9" >&2
    echo "      Windows PowerShell:  Get-NetTCPConnection -LocalPort 8741 | % { Stop-Process -Id \$_.OwningProcess -Force }" >&2
    exit 1
  fi
else
  stop_sidecar_on_8741
  start_source_sidecar
fi

export RUSHI_SKIP_BUNDLED_ASR=1
cd "$ROOT"

# Pass-through (e.g. --release): cargo release + Vite HMR — closer to install-package
# timing than default debug `desktop:dev`. Sign-off still needs `release:win` / install media.
for arg in "$@"; do
  if [[ "${arg}" == "--release" ]]; then
    echo "==> tauri dev --release (Rust release profile; use for playback / perf parity)"
    break
  fi
done

exec npm run tauri dev -w @rushi/desktop -- --features devtools "$@"

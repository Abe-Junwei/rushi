#!/usr/bin/env bash
# v1 发版包安装后冒烟（机器可重复部分）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${RUSHI_RELEASE_APP:-${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app}"
BIN="${APP}/Contents/MacOS/rushi-desktop"
APP_ROOT="$(bash "${ROOT}/scripts/resolve-app-data-root.sh")"
LOG="${APP_ROOT}/logs/desktop.log"
EVIDENCE="${ROOT}/docs/execution/v1-release-installed-smoke-evidence.md"
FFMPEG="$(bash "${ROOT}/scripts/resolve-bundled-tool-in-app.sh" "${APP}" ffmpeg)"
FFPROBE="$(bash "${ROOT}/scripts/resolve-bundled-tool-in-app.sh" "${APP}" ffprobe)"
STAMP="$(bash "${ROOT}/scripts/resolve-bundled-sidecar-stamp-in-app.sh" "${APP}")"

[[ -x "${BIN}" ]] || { echo "Missing release app: ${BIN}" >&2; exit 1; }

# Local Tauri `linker-signed` adhoc often fails Gatekeeper/smoke until deep re-sign.
# Skip when already Developer ID signed, or when RUSHI_SKIP_CODESIGN_REPAIR=1.
if [[ "${RUSHI_SKIP_CODESIGN_REPAIR:-0}" != "1" ]] && command -v codesign >/dev/null 2>&1; then
  if codesign -dv --verbose=2 "${APP}" 2>&1 | grep -q 'Signature=adhoc\|flags=.*linker-signed\|TeamIdentifier=not set'; then
    echo "== codesign repair (deep adhoc) =="
    codesign --force --deep --sign - "${APP}"
    echo "  OK: codesign --force --deep --sign -"
  fi
fi

echo "== v1 installed smoke =="
echo "App: ${APP}"
echo "App data: ${APP_ROOT}"

# Avoid duplicate instances from dev
pkill -f "${BIN}" 2>/dev/null || true
PORT_PIDS="$(lsof -ti :8741 2>/dev/null || true)"
if [[ -n "${PORT_PIDS}" ]]; then
  echo "== Stop pre-existing ASR listeners on 8741 (${PORT_PIDS}) =="
  kill ${PORT_PIDS} 2>/dev/null || true
fi
sleep 2

wait_for_app_exit() {
  for _ in $(seq 1 30); do
    if ! pgrep -f "${BIN}" >/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

stop_port_8741() {
  local pids
  pids="$(lsof -ti :8741 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "== Stop ASR listeners on 8741 (${pids}) =="
    kill ${pids} 2>/dev/null || true
    sleep 2
  fi
}

LOG_MARK=""
if [[ -f "${LOG}" ]]; then
  LOG_MARK="$(wc -l < "${LOG}" | tr -d ' ')"
fi

if [[ -x "${FFMPEG}" ]]; then
  echo "  OK: bundled ffmpeg in .app (${FFMPEG})"
else
  echo "  FAIL: missing bundled ffmpeg at ${FFMPEG}" >&2
  exit 1
fi
if [[ -x "${FFPROBE}" ]]; then
  echo "  OK: bundled ffprobe in .app (${FFPROBE})"
else
  echo "  FAIL: missing bundled ffprobe at ${FFPROBE}" >&2
  exit 1
fi
if [[ -s "${STAMP}" ]]; then
  SIDECAR_STAMP="$(tr '\n' ' ' < "${STAMP}" | sed 's/[[:space:]]*$//')"
  echo "  OK: bundled sidecar stamp (${SIDECAR_STAMP})"
else
  echo "  FAIL: missing sidecar build stamp at ${STAMP}" >&2
  exit 1
fi

mkdir -p "${APP_ROOT}/logs"
WRITE_PROBE="${APP_ROOT}/logs/installed-smoke-write-probe.txt"
if printf 'installed smoke %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${WRITE_PROBE}"; then
  echo "  OK: App Data writable"
  rm -f "${WRITE_PROBE}"
else
  echo "FAIL: App Data not writable: ${APP_ROOT}" >&2
  exit 1
fi

DIAG_ZIP="/tmp/rushi-installed-smoke-diagnostic.zip"
rm -f "${DIAG_ZIP}" "${DIAG_ZIP}.part"

echo "== LaunchServices probe (normal .app launch) =="
open -n "${APP}"
sleep 8
if ! pgrep -f "${BIN}" >/dev/null; then
  echo "FAIL: app not running after LaunchServices open" >&2
  exit 1
fi
echo "  OK: LaunchServices open started app"
if command -v osascript >/dev/null 2>&1; then
  LS_WINDOW_COUNT="$(osascript -e 'tell application "System Events" to count windows of process "如是我闻"' 2>/dev/null || echo "unknown")"
  if [[ "${LS_WINDOW_COUNT}" =~ ^[0-9]+$ ]] && [[ "${LS_WINDOW_COUNT}" -gt 0 ]]; then
    echo "  OK: LaunchServices window visible (${LS_WINDOW_COUNT})"
  else
    echo "  WARN: LaunchServices window count unavailable (${LS_WINDOW_COUNT})"
  fi
fi
pkill -f "${BIN}" 2>/dev/null || true
if ! wait_for_app_exit; then
  echo "FAIL: LaunchServices probe app did not exit after pkill" >&2
  exit 1
fi
stop_port_8741

echo "== Automation launch (25s observe — bundled sidecar cold start) =="
RUSHI_AUTOMATION=1 RUSHI_AUTOMATION_DIAGNOSTIC_ZIP="${DIAG_ZIP}" "${BIN}" >/tmp/rushi-installed-smoke-app.log 2>&1 &
APP_PID=$!
sleep 25

if ! pgrep -f "${BIN}" >/dev/null; then
  echo "FAIL: process not running after launch" >&2
  echo "  app stdout/stderr: /tmp/rushi-installed-smoke-app.log" >&2
  exit 1
fi
echo "  OK: rushi-desktop process running"
if kill -0 "${APP_PID}" 2>/dev/null; then
  echo "  OK: launched binary pid=${APP_PID}"
fi

if command -v osascript >/dev/null 2>&1; then
  WINDOW_COUNT="$(osascript -e 'tell application "System Events" to count windows of process "如是我闻"' 2>/dev/null || echo "unknown")"
  if [[ "${WINDOW_COUNT}" =~ ^[0-9]+$ ]] && [[ "${WINDOW_COUNT}" -gt 0 ]]; then
    echo "  OK: macOS window visible (${WINDOW_COUNT})"
  else
    echo "  WARN: macOS window count unavailable (${WINDOW_COUNT})"
  fi
fi

if [[ -f "${LOG}" ]]; then
  NEW_LINES="$(wc -l < "${LOG}" | tr -d ' ')"
  if [[ -n "${LOG_MARK}" ]] && [[ "${NEW_LINES}" -gt "${LOG_MARK}" ]]; then
    echo "  OK: desktop.log grew (${LOG_MARK} -> ${NEW_LINES})"
    tail -5 "${LOG}" | sed 's/^/    /'
  else
    echo "  WARN: desktop.log unchanged (first launch may use new path: ${LOG})"
  fi
  PARITY_TAIL="$(grep -E 'parity (startup|bundle|project|asr|asset|waveform|transcribe)' "${LOG}" | tail -10 || true)"
  if [[ -n "${PARITY_TAIL}" ]]; then
    echo "  OK: parity log lines present"
    printf '%s\n' "${PARITY_TAIL}" | sed 's/^/    /'
  else
    echo "  WARN: no parity log lines found yet"
  fi
else
  echo "  WARN: no desktop.log yet at ${LOG}"
fi

for _ in $(seq 1 20); do
  [[ -s "${DIAG_ZIP}" ]] && break
  sleep 0.5
done
if [[ ! -s "${DIAG_ZIP}" ]]; then
  echo "FAIL: automation diagnostic zip was not generated: ${DIAG_ZIP}" >&2
  echo "  app stdout/stderr: /tmp/rushi-installed-smoke-app.log" >&2
  exit 1
fi
python3 - <<'PY'
import sys, zipfile
path = "/tmp/rushi-installed-smoke-diagnostic.zip"
required = {
    "build-info.txt",
    "environment.txt",
    "local-runtime.txt",
    "asr-setup.txt",
    "project-summary.txt",
    "parity-log.txt",
    "redactions.txt",
}
with zipfile.ZipFile(path) as z:
    names = set(z.namelist())
missing = sorted(required - names)
if missing:
    print("missing diagnostic entries:", ", ".join(missing), file=sys.stderr)
    sys.exit(1)
PY
echo "  OK: automation diagnostic zip generated (${DIAG_ZIP})"

if [[ -f "${APP_ROOT}/rushi.sqlite3" ]]; then
  N="$(sqlite3 "${APP_ROOT}/rushi.sqlite3" "SELECT COUNT(*) FROM segments;" 2>/dev/null || echo 0)"
  echo "  OK: app DB segments=${N}"
else
  echo "  WARN: no rushi.sqlite3 (fresh install)"
fi

PEAKS_COUNT=0
if [[ -d "${APP_ROOT}/projects" ]]; then
  PEAKS_COUNT="$(find "${APP_ROOT}/projects" -name '*.dat' 2>/dev/null | wc -l | tr -d ' ')"
fi
echo "  NOTE: waveform peak .dat files on disk: ${PEAKS_COUNT} (import audio in UI to generate)"

HEALTH_JSON="/tmp/rushi-installed-smoke-health.json"
if curl -sf --max-time 8 http://127.0.0.1:8741/health -o "${HEALTH_JSON}"; then
  if python3 - <<'PY'
import json, sys
with open("/tmp/rushi-installed-smoke-health.json", encoding="utf-8") as f:
    b = json.load(f)
ok = b.get("service") == "rushi-asr" and b.get("funasr_import_ok") is True
sys.exit(0 if ok else 1)
PY
  then
    echo "  OK: ASR /health funasr_import_ok"
  else
    echo "  WARN: /health reachable but funasr not ready (models may still be preparing)"
  fi
else
  echo "  NOTE: 8741 not ready — complete「一键准备」in UI if fresh install"
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "${EVIDENCE}" <<EOF
# v1 安装包冒烟证据

- **时间（UTC）**：${TS}
- **包**：\`${APP}\`
- **App Data**：\`${APP_ROOT}\`
- **机器结论**：进程启动 ✅ · App Data 可写 ✅ · bundled ffmpeg/ffprobe ✅ · sidecar stamp ✅ · diagnostic zip ✅
- **侧车构建**：\`${SIDECAR_STAMP}\`

## 仍需 UI 手测

见 [v1-release-build-evidence.md](./v1-release-build-evidence.md) §发版后手测。

## 本次自动检查

- bundled \`ffmpeg\` 在 Resources
- bundled \`ffprobe\` 在 Resources
- bundled sidecar build stamp 在 Resources
- App Data 写入探针通过
- LaunchServices \`open -n\` 启动探针通过
- automation binary launch 后 \`pgrep rushi-desktop\` 通过
- 自动诊断包生成并包含 release parity 证据文件
- \`/health\` 与 peaks 计数见构建日志
- \`desktop.log\` parity 摘要见终端输出
EOF

echo ""
echo "OK: installed smoke passed (machine). Evidence: ${EVIDENCE}"
echo "Quit app: pkill -f '${BIN}'"

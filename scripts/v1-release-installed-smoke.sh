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

[[ -x "${BIN}" ]] || { echo "Missing release app: ${BIN}" >&2; exit 1; }

echo "== v1 installed smoke =="
echo "App: ${APP}"
echo "App data: ${APP_ROOT}"

# Avoid duplicate instances from dev
pkill -f "${BIN}" 2>/dev/null || true
sleep 2

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

echo "== Launch (25s observe — bundled sidecar cold start) =="
open -n "${APP}"
sleep 25

if ! pgrep -f "${BIN}" >/dev/null; then
  echo "FAIL: process not running after launch" >&2
  exit 1
fi
echo "  OK: rushi-desktop process running"

if [[ -f "${LOG}" ]]; then
  NEW_LINES="$(wc -l < "${LOG}" | tr -d ' ')"
  if [[ -n "${LOG_MARK}" ]] && [[ "${NEW_LINES}" -gt "${LOG_MARK}" ]]; then
    echo "  OK: desktop.log grew (${LOG_MARK} -> ${NEW_LINES})"
    tail -5 "${LOG}" | sed 's/^/    /'
  else
    echo "  WARN: desktop.log unchanged (first launch may use new path: ${LOG})"
  fi
else
  echo "  WARN: no desktop.log yet at ${LOG}"
fi

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
- **机器结论**：进程启动 ✅ · bundled ffmpeg ✅

## 仍需 UI 手测

见 [v1-release-build-evidence.md](./v1-release-build-evidence.md) §发版后手测。

## 本次自动检查

- bundled \`ffmpeg\` 在 Resources
- \`open -n\` 后 \`pgrep rushi-desktop\` 通过
- \`/health\` 与 peaks 计数见构建日志
EOF

echo ""
echo "OK: installed smoke passed (machine). Evidence: ${EVIDENCE}"
echo "Quit app: pkill -f '${BIN}'"

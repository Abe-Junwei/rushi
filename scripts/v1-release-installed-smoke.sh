#!/usr/bin/env bash
# v1 发版包安装后冒烟（机器可重复部分）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${RUSHI_RELEASE_APP:-${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app}"
BIN="${APP}/Contents/MacOS/rushi-desktop"
APP_ROOT="${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi"
LOG="${APP_ROOT}/logs/desktop.log"
EVIDENCE="${ROOT}/docs/execution/v1-release-installed-smoke-evidence.md"

[[ -x "${BIN}" ]] || { echo "Missing release app: ${BIN}" >&2; exit 1; }

echo "== v1 installed smoke =="
echo "App: ${APP}"

# Avoid duplicate instances from dev
pkill -f "${BIN}" 2>/dev/null || true
sleep 2

LOG_MARK=""
if [[ -f "${LOG}" ]]; then
  LOG_MARK="$(wc -l < "${LOG}" | tr -d ' ')"
fi

echo "== Launch (15s observe) =="
open -n "${APP}"
sleep 15

if ! pgrep -f "${BIN}" >/dev/null; then
  echo "FAIL: process not running after launch" >&2
  exit 1
fi
echo "  OK: rushi-desktop process running"

if [[ -f "${LOG}" ]]; then
  NEW_LINES="$(wc -l < "${LOG}" | tr -d ' ')"
  if [[ -n "${LOG_MARK}" ]] && [[ "${NEW_LINES}" -gt "${LOG_MARK}" ]]; then
    echo "  OK: desktop.log grew (${LOG_MARK} -> ${NEW_LINES})"
    tail -3 "${LOG}" | sed 's/^/    /'
  else
    echo "  WARN: desktop.log unchanged (first launch may use new path)"
  fi
else
  echo "  WARN: no desktop.log yet at ${LOG}"
fi

if [[ -f "${APP_ROOT}/rushi.sqlite3" ]]; then
  N="$(sqlite3 "${APP_ROOT}/rushi.sqlite3" "SELECT COUNT(*) FROM segments;" 2>/dev/null || echo 0)"
  echo "  OK: existing app DB segments=${N}"
else
  echo "  WARN: no rushi.sqlite3 (fresh install)"
fi

if [[ -f "${APP_ROOT}/quality/last_eval_report.json" ]]; then
  echo "  OK: quality report present (E1 UI data)"
else
  echo "  WARN: no last_eval_report.json"
fi

if curl -sf --max-time 3 http://127.0.0.1:8741/health >/dev/null 2>&1; then
  echo "  OK: ASR 8741 reachable (dev/LRC sidecar already up)"
else
  echo "  NOTE: 8741 down — 安装包首启需在 UI 完成 ASR/LRC（见 evidence 手测 1–2）"
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "${EVIDENCE}" <<EOF
# v1 安装包冒烟证据

- **时间（UTC）**：${TS}
- **包**：\`${APP}\`
- **机器结论**：进程启动 ✅ · 复用既有 App Data（若存在）✅

## 仍需 UI 手测（5 步）

见 [v1-release-build-evidence.md](./v1-release-build-evidence.md) §发版后手测。

## 本次自动检查

- \`open -n\` 启动后 \`pgrep rushi-desktop\` 通过
- \`desktop.log\` / \`rushi.sqlite3\` / \`quality/last_eval_report.json\` 状态见构建日志
EOF

echo ""
echo "OK: installed smoke passed (machine). Evidence: ${EVIDENCE}"
echo "Quit app: pkill -f '${BIN}'"

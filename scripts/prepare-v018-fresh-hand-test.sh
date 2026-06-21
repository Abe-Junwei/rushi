#!/usr/bin/env bash
# Preflight for v0.1.8 P8′–P10′ Fresh hand test (Plan B bundled seed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${RUSHI_RELEASE_APP:-/Applications/如是我闻.app}"
SAMPLE="${ROOT}/fixtures/eval/samples/clear.wav"
APP_DATA="${HOME}/Library/Application Support/studio.lingchuang.rushi"

echo "== v0.1.8 Fresh hand test preflight =="
echo "    app=${APP}"
echo ""

fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -d "${APP}" ]] || fail "Release app missing: ${APP}"
[[ -x "${APP}/Contents/MacOS/rushi-desktop" ]] || fail "Binary missing in ${APP}"

BUNDLED="${APP}/Contents/Resources/resources/bundled-asr-models"
[[ -f "${BUNDLED}/manifest.json" && -d "${BUNDLED}/modelscope" ]] \
  || fail "bundled-asr-models incomplete (run npm run asr:stage-bundled-models && desktop:build-app)"
BUNDLED_SIZE="$(du -sh "${BUNDLED}" | awk '{print $1}')"
echo "OK: bundled-asr-models ${BUNDLED_SIZE}"

[[ -f "${SAMPLE}" ]] || fail "P9′ sample missing: ${SAMPLE}"
echo "OK: test audio ${SAMPLE}"

pkill -f "npm run desktop:dev" 2>/dev/null || true
pkill -f "rushi-desktop" 2>/dev/null || true
sleep 1
if lsof -ti :8741 >/dev/null 2>&1; then
  fail "port 8741 still in use — stop dev sidecar first"
fi
echo "OK: 8741 free, dev app stopped"

if [[ "${RUSHI_FRESH_WIPE_MAIN_MODELS:-1}" -eq 1 ]]; then
  if [[ -d "${APP_DATA}/models" ]]; then
    rm -rf "${APP_DATA}/models"
    echo "OK: wiped ${APP_DATA}/models (main profile fresh seed)"
  else
    echo "OK: main profile has no models/ (already fresh)"
  fi
fi

VERSION="$("${APP}/Contents/MacOS/rushi-desktop" --version 2>/dev/null || true)"
echo ""
echo "== Ready for P8′–P10′ =="
echo ""
echo "1. **断网**（Wi‑Fi 关 / 飞行模式）"
echo "2. 启动 Fresh（隔离 HOME，推荐）："
echo ""
echo "   cd \"${ROOT}\""
echo "   export RUSHI_RELEASE_APP=\"${APP}\""
echo "   bash scripts/r3f-fresh-appdata-hand-test.sh --interactive --wipe-ui-prefs"
echo ""
echo "   或手动打开（主 App Data 已清 models）："
echo "   open -a \"${APP}\""
echo ""
echo "3. P8′ 目视：全屏「正在准备内置语音模型…」+ 进度"
echo "4. P9′ 断网转写：导入 ${SAMPLE}"
echo "5. P10′ 环境页：仅 Paraformer"
echo ""
echo "Runbook: docs/execution/specs/v0.1.8-p8-prime-offline-fresh-hand-test-runbook.md"
echo "Log: tail -f \"${APP_DATA}/logs/desktop.log\""

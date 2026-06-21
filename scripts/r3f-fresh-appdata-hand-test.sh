#!/usr/bin/env bash
# R3f — 首装空 App Data「一键准备」复验（隔离 HOME，不污染主 App Data）
# Usage: bash scripts/r3f-fresh-appdata-hand-test.sh [--interactive] [--with-ui] [--skip-download] [--wipe-ui-prefs] [--exit-after-pass]
#  推荐 release 手测：--interactive（你在窗口里点「设置→一键准备」，无需辅助功能；通过后应用保持打开）
#  --with-ui：osascript 自动点按钮，需 Terminal/Cursor → 系统设置 → 隐私与安全性 → 辅助功能
#  --exit-after-pass：通过后仍关闭应用并删除隔离 HOME（CI / 全自动用；与 --interactive 联用可覆盖默认保活）
#
# 注意：默认仅隔离 HOME 下的 SQLite / models / logs。WebKit localStorage 与 macOS 钥匙串
# 不在 HOME 内，会沿用本机旧配置。Fresh 手测在线 STT / LLM 状态时请加 --wipe-ui-prefs。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${RUSHI_RELEASE_APP:-${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app}"
BIN="${APP}/Contents/MacOS/rushi-desktop"
BASE="http://127.0.0.1:8741"
PARAFORMER="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
WITH_UI=0
INTERACTIVE=0
SKIP_DOWNLOAD=0
WIPE_UI_PREFS=0
EXIT_AFTER_PASS=0
TEST_PASSED=0
KEEP_APP_ON_PASS=0
for arg in "$@"; do
  case "$arg" in
    --with-ui) WITH_UI=1 ;;
    --interactive) INTERACTIVE=1 ;;
    --skip-download) SKIP_DOWNLOAD=1 ;;
    --wipe-ui-prefs) WIPE_UI_PREFS=1 ;;
    --exit-after-pass) EXIT_AFTER_PASS=1 ;;
  esac
done
if [[ "${INTERACTIVE}" -eq 1 && "${EXIT_AFTER_PASS}" -eq 0 ]]; then
  KEEP_APP_ON_PASS=1
fi

[[ -x "${BIN}" ]] || { echo "Missing release app: ${BIN}" >&2; exit 1; }

FRESH_HOME="$(mktemp -d "${TMPDIR:-/tmp}/rushi-fresh-home.XXXXXX")"
FRESH_APP_BASE="${FRESH_HOME}/Library/Application Support/studio.lingchuang.rushi"
mkdir -p "${FRESH_APP_BASE}"
OUT_DIR="${TMPDIR:-/tmp}/r3f-fresh-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${OUT_DIR}"
EVIDENCE="${ROOT}/docs/execution/specs/r3f-fresh-appdata-hand-test-evidence.md"
UI_RESULT="skipped"
PREPARE_VIA="http"

stop_all() {
  pkill -f "${BIN}" 2>/dev/null || true
  local pids
  pids="$(lsof -ti :8741 2>/dev/null || true)"
  [[ -n "${pids}" ]] && kill -9 ${pids} 2>/dev/null || true
  sleep 1
}

cleanup() {
  if [[ "${KEEP_APP_ON_PASS}" -eq 1 && "${TEST_PASSED}" -eq 1 ]]; then
    return 0
  fi
  stop_all
  rm -rf "${FRESH_HOME}"
}
trap cleanup EXIT INT TERM

wipe_ui_prefs_if_requested() {
  if [[ "${WIPE_UI_PREFS}" -ne 1 ]]; then
    echo "  NOTE: WebKit localStorage + macOS Keychain 未隔离；在线 STT/LLM 可能显示旧配置就绪"
    echo "        Fresh 测 F1/H 在线能力时请加 --wipe-ui-prefs（钥匙串仍共享，仅清 UI 偏好）"
    return 0
  fi
  local webkit_dir="${HOME}/Library/WebKit/studio.lingchuang.rushi"
  if [[ -d "${webkit_dir}" ]]; then
    echo "== Wipe WebKit WebsiteData for studio.lingchuang.rushi =="
    rm -rf "${webkit_dir}"
    echo "  OK: removed ${webkit_dir}"
  else
    echo "  NOTE: no WebKit dir at ${webkit_dir}"
  fi
}
wait_health() {
  local tries="${1:-60}"
  local out="${OUT_DIR}/health-wait.json"
  local i
  for ((i = 1; i <= tries; i++)); do
    if curl -sf --max-time 5 "${BASE}/health" -o "${out}" 2>/dev/null; then
      if python3 - "${out}" <<'PY'
import json, sys
h = json.load(open(sys.argv[1], encoding="utf-8"))
sys.exit(0 if h.get("service") == "rushi-asr" and h.get("funasr_import_ok") is True else 1)
PY
      then
        cp "${out}" "${OUT_DIR}/health-after-sidecar.json"
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

wait_ready_for_transcribe() {
  local deadline_sec="${1:-900}"
  local out="${OUT_DIR}/health-ready.json"
  local start now
  start="$(date +%s)"
  while true; do
    now="$(date +%s)"
    if (( now - start > deadline_sec )); then
      echo "  FAIL: timeout waiting ready_for_transcribe (${deadline_sec}s)" >&2
      return 1
    fi
    if curl -sf --max-time 8 "${BASE}/health" -o "${out}" 2>/dev/null; then
      if python3 - "${out}" <<'PY'
import json, sys
h = json.load(open(sys.argv[1], encoding="utf-8"))
ok = (
    h.get("ready_for_transcribe") is True
    and h.get("funasr_default_model_cached") is True
    and h.get("funasr_required_models_cached") is True
)
sys.exit(0 if ok else 1)
PY
      then
        cp "${out}" "${OUT_DIR}/health-ready-final.json"
        return 0
      fi
    fi
    sleep 3
  done
}

health_ready_now() {
  local out="${OUT_DIR}/health-ready-poll.json"
  curl -sf --max-time 8 "${BASE}/health" -o "${out}" 2>/dev/null || return 1
  python3 - "${out}" <<'PY'
import json, sys
h = json.load(open(sys.argv[1], encoding="utf-8"))
ok = (
    h.get("ready_for_transcribe") is True
    and h.get("funasr_default_model_cached") is True
    and h.get("funasr_required_models_cached") is True
)
sys.exit(0 if ok else 1)
PY
}

resolve_bundled_models_in_app() {
  local candidates=(
    "${APP}/Contents/Resources/resources/bundled-asr-models"
    "${APP}/Contents/Resources/bundled-asr-models"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "${candidate}/manifest.json" && -d "${candidate}/modelscope" ]]; then
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}

wait_bundled_seed_and_ready() {
  local deadline_sec="${1:-1800}"
  local marker="${FRESH_APP_BASE}/models/.rushi-bundled-seed.json"
  local start now out
  start="$(date +%s)"
  echo "== Plan B: wait bundled seed + ready_for_transcribe (max ${deadline_sec}s) =="
  while true; do
    now="$(date +%s)"
    if (( now - start > deadline_sec )); then
      echo "  FAIL: bundled seed / ready timeout (${deadline_sec}s)" >&2
      return 1
    fi
    if [[ -f "${marker}" ]]; then
      echo "  OK: seed marker at ${marker}"
    fi
    out="${OUT_DIR}/health-ready-poll.json"
    if curl -sf --max-time 8 "${BASE}/health" -o "${out}" 2>/dev/null; then
      if health_ready_now; then
        cp "${out}" "${OUT_DIR}/health-ready-final.json"
        echo "  OK: ready_for_transcribe after bundled seed"
        return 0
      fi
      python3 - "${out}" <<'PY' || true
import json, sys
h = json.load(open(sys.argv[1], encoding="utf-8"))
print(
    f"  poll: service={h.get('service')!r} import_ok={h.get('funasr_import_ok')!r} "
    f"cached={h.get('funasr_default_model_cached')!r} ready={h.get('ready_for_transcribe')!r}"
)
PY
    else
      echo "  poll: /health unreachable (seed may still be running)"
    fi
    sleep 5
  done
}

wait_interactive_one_click() {
  echo ""
  echo ">>> 请在 release 应用窗口操作：左下「设置」→「本机 ASR」→「一键准备」"
  echo ">>> 脚本将轮询 /health（最多 15 分钟）；无需终端命令"
  echo ""
  local deadline=$(( $(date +%s) + 900 ))
  while (( $(date +%s) < deadline )); do
    if health_ready_now; then
      cp "${OUT_DIR}/health-ready-poll.json" "${OUT_DIR}/health-ready-final.json"
      echo "  OK: ready_for_transcribe after interactive one-click"
      return 0
    fi
    sleep 5
  done
  echo "  FAIL: interactive one-click timeout (900s)" >&2
  return 1
}

try_ui_one_click() {
  local script="${OUT_DIR}/ui-one-click.applescript"
  cat > "${script}" <<'APPLESCRIPT'
tell application "System Events"
  repeat with procName in {"rushi-desktop", "如是我闻"}
    if exists process procName then
      tell process procName
        set frontmost to true
        delay 2
        try
          click button "设置" of window 1
        on error errMsg number errNum
          error "settings click failed (" & errNum & "): " & errMsg
        end try
        delay 2
        try
          click button "一键准备" of window 1
        on error
          try
            click button "一键准备" of sheet 1 of window 1
          on error errMsg2 number errNum2
            error "one-click failed (" & errNum2 & "): " & errMsg2
          end try
        end try
      end tell
      return "OK:" & procName
    end if
  end repeat
end tell
return "FAIL:no-process"
APPLESCRIPT
  osascript "${script}" 2>"${OUT_DIR}/ui-one-click.err"
}

health_requires_token() {
  curl -sf --max-time 5 "${BASE}/health" -o "${OUT_DIR}/health-token-check.json" 2>/dev/null || return 1
  python3 - "${OUT_DIR}/health-token-check.json" <<'PY'
import json, sys
h = json.load(open(sys.argv[1], encoding="utf-8"))
sys.exit(0 if h.get("local_token_required") is True else 1)
PY
}

run_http_prepare() {
  if health_requires_token; then
    echo "  SKIP: bundled sidecar requires x-rushi-local-token (use UI one-click or Tauri loopback)" >&2
    return 2
  fi
  local start_json="${OUT_DIR}/prepare-start.json"
  echo "  POST ${BASE}/v1/models/prepare/async (${PARAFORMER})"
  curl -sf --max-time 30 -X POST "${BASE}/v1/models/prepare/async" \
    -H "Content-Type: application/json" \
    -d "{\"model_id\":\"${PARAFORMER}\"}" \
    -o "${start_json}" || {
    echo "  FAIL: prepare/async" >&2
    cat "${start_json}" 2>/dev/null || true
    return 1
  }
  local deadline=$(( $(date +%s) + 900 ))
  while (( $(date +%s) < deadline )); do
    curl -sf --max-time 10 "${BASE}/v1/models/prepare-status" -o "${OUT_DIR}/prepare-status.json" || sleep 2
    python3 - "${OUT_DIR}/prepare-status.json" <<'PY'
import json, sys
st = json.load(open(sys.argv[1], encoding="utf-8"))
phase = st.get("phase")
if phase == "done":
    sys.exit(0)
if phase == "error":
    print(st.get("message") or st, file=sys.stderr)
    sys.exit(2)
sys.exit(1)
PY
    code=$?
    if [[ "${code}" -eq 0 ]]; then
      return 0
    fi
    if [[ "${code}" -eq 2 ]]; then
      return 1
    fi
    sleep 3
  done
  echo "  FAIL: prepare-status timeout" >&2
  return 1
}

echo "== R3f fresh App Data hand test =="
echo "Fresh HOME: ${FRESH_HOME}"
echo "Release app: ${APP}"

wipe_ui_prefs_if_requested

stop_all
echo "== Launch release app (isolated HOME) =="
HOME="${FRESH_HOME}" open -n "${APP}"
sleep 5
if ! pgrep -f "${BIN}" >/dev/null; then
  echo "FAIL: app did not start" >&2
  exit 1
fi
echo "  OK: rushi-desktop running"

BUNDLED_MODELS_DIR=""
USE_BUNDLED_SEED=0
if BUNDLED_MODELS_DIR="$(resolve_bundled_models_in_app)"; then
  echo "  Plan B: bundled-asr-models in app (${BUNDLED_MODELS_DIR})"
  USE_BUNDLED_SEED=1
else
  echo "  NOTE: no bundled-asr-models in app — legacy one-click / HTTP prepare path"
fi

if [[ "${USE_BUNDLED_SEED}" -eq 1 && "${SKIP_DOWNLOAD}" -eq 0 ]]; then
  wait_bundled_seed_and_ready 1800 || exit 1
  PREPARE_VIA="bundled-seed-auto"
  UI_RESULT="n/a"
elif [[ "${USE_BUNDLED_SEED}" -eq 1 && "${SKIP_DOWNLOAD}" -eq 1 ]]; then
  echo "== --skip-download: bundled app, sidecar gate only =="
  if ! wait_health 90; then
    echo "FAIL: sidecar /health not ready in 180s" >&2
    exit 1
  fi
  UI_RESULT="n/a"
  PREPARE_VIA="none"
else
  echo "== Wait bundled sidecar /health =="
  if ! wait_health 90; then
    echo "FAIL: sidecar /health not ready in 180s" >&2
    exit 1
  fi
  python3 - "${OUT_DIR}/health-after-sidecar.json" <<'PY'
import json, sys
h = json.load(open(sys.argv[1], encoding="utf-8"))
cached = h.get("funasr_default_model_cached")
ready = h.get("ready_for_transcribe")
print(f"  funasr_default_model_cached={cached} ready_for_transcribe={ready}")
if cached is True and ready is True:
    print("  WARN: fresh HOME already shows cached models (unexpected)")
elif cached is not False:
    print("  NOTE: expected funasr_default_model_cached=false on first launch")
PY

  if [[ "${SKIP_DOWNLOAD}" -eq 1 ]]; then
    echo "== --skip-download: sidecar gate only =="
    UI_RESULT="n/a"
    PREPARE_VIA="none"
  else
  if [[ "${INTERACTIVE}" -eq 1 ]]; then
    echo "== Interactive: UI 一键准备（轮询 /health） =="
    UI_RESULT="interactive"
    PREPARE_VIA="ui-interactive"
    wait_interactive_one_click
  elif [[ "${WITH_UI}" -eq 1 ]]; then
    echo "== UI: 设置 → 一键准备 (osascript) =="
    if ui_out="$(try_ui_one_click)"; then
      echo "  ${ui_out}"
      UI_RESULT="ok"
      PREPARE_VIA="ui"
    else
      UI_RESULT="failed"
      echo "  WARN: UI automation failed — see ${OUT_DIR}/ui-one-click.err"
      cat "${OUT_DIR}/ui-one-click.err" 2>/dev/null | sed 's/^/    /' || true
      if health_requires_token; then
        echo "  NOTE: release 侧车需 UI 一键准备（loopback token）；osascript 未获辅助功能权限。" >&2
        echo "  → 改为等待你手动操作（等同 --interactive）；应用会保持打开。" >&2
        echo "  → 全自动需：系统设置 → 隐私与安全性 → 辅助功能 → 勾选 Terminal 或 Cursor" >&2
        UI_RESULT="failed→interactive"
        PREPARE_VIA="ui-interactive-fallback"
        wait_interactive_one_click || exit 1
      else
        echo "== Fallback: HTTP prepare (dev sidecar without token) =="
        run_http_prepare || exit 1
        PREPARE_VIA="http-fallback"
      fi
    fi
  else
    echo "== HTTP one-click model step (dev sidecar only) =="
    if health_requires_token; then
      echo "FAIL: release bundled sidecar requires --interactive (Tauri loopback token)" >&2
      exit 1
    fi
    run_http_prepare || exit 1
    PREPARE_VIA="http"
  fi

  echo "== Wait ready_for_transcribe =="
  if ! health_ready_now; then
    wait_ready_for_transcribe 900
  else
    cp "${OUT_DIR}/health-ready-poll.json" "${OUT_DIR}/health-ready-final.json"
  fi
  fi
fi

LOG="${FRESH_APP_BASE}/logs/desktop.log"
if [[ -f "${LOG}" ]]; then
  cp "${LOG}" "${OUT_DIR}/desktop.log"
  if grep -E 'npm run desktop:dev|tauri dev' "${LOG}" >/dev/null; then
    echo "FAIL: dev npm strings in fresh install log" >&2
    exit 1
  fi
  echo "  OK: fresh desktop.log has no dev npm strings"
else
  echo "  NOTE: no desktop.log under ${FRESH_APP_BASE} (may use nested legacy path)"
  find "${FRESH_HOME}/Library/Application Support" -name desktop.log 2>/dev/null | head -3
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
MACOS="$(sw_vers -productVersion 2>/dev/null || echo unknown)"
if [[ "${SKIP_DOWNLOAD}" -eq 1 ]]; then
  PREPARE_RESULT="⏸ skip-download"
else
  PREPARE_RESULT="✅"
fi
if [[ "${KEEP_APP_ON_PASS}" -eq 1 ]]; then
  FRESH_HOME_NOTE="应用仍运行，关闭后可手动删除"
else
  FRESH_HOME_NOTE="测试结束已删除"
fi
CMD_FLAGS=""
[[ "${INTERACTIVE}" -eq 1 ]] && CMD_FLAGS+=" --interactive"
[[ "${WITH_UI}" -eq 1 ]] && CMD_FLAGS+=" --with-ui"
[[ "${SKIP_DOWNLOAD}" -eq 1 ]] && CMD_FLAGS+=" --skip-download"
[[ "${WIPE_UI_PREFS}" -eq 1 ]] && CMD_FLAGS+=" --wipe-ui-prefs"
[[ "${EXIT_AFTER_PASS}" -eq 1 ]] && CMD_FLAGS+=" --exit-after-pass"
TEST_PASSED=1
cat > "${EVIDENCE}" <<EOF
# R3f 首装空 App Data — 手测证据

- **时间（UTC）**：${TS}
- **macOS**：${MACOS}
- **隔离 HOME**：\`${FRESH_HOME}\`（${FRESH_HOME_NOTE}）
- **包**：\`${APP}\`
- **命令**：\`bash scripts/r3f-fresh-appdata-hand-test.sh${CMD_FLAGS}\`

## 结论

| 项 | 结果 |
|----|------|
| release \`.app\` + 空 App Data 启动 | ✅ |
| bundled 侧车 \`/health\` \`funasr_import_ok\` | ✅ |
| 首装模型未缓存（预期 \`funasr_default_model_cached=false\`） | ✅ 见 \`health-after-sidecar.json\` |
| 一键准备 / bundled seed（${PREPARE_VIA}）→ \`ready_for_transcribe\` | ${PREPARE_RESULT} |
| UI osascript | ${UI_RESULT} |
| log 无 \`desktop:dev\` 文案 | ✅ |

## 产物

- Artifacts: \`${OUT_DIR}\`（临时目录，可手动清理）

## 说明

- 隔离 \`HOME\` 等价于干净用户首装 App Data，**不修改**主 \`~/Library/Application Support/...\`。
- Plan B release 包首启自动 bundled seed（全屏遮罩）；脚本轮询 marker + \`/health\`，无需 UI 一键准备。Legacy 无随包模型时仍用 \`--interactive\` 或 \`--with-ui\`。
EOF

echo ""
echo "OK: R3f fresh App Data hand test passed. Evidence: ${EVIDENCE}"
if [[ "${KEEP_APP_ON_PASS}" -eq 1 ]]; then
  echo "NOTE: 应用保持运行（隔离 HOME: ${FRESH_HOME}）"
  echo "      关闭应用后如需清理: rm -rf \"${FRESH_HOME}\""
fi

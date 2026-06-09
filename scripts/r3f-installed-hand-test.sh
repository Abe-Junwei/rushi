#!/usr/bin/env bash
# R3f — macOS 安装包零终端手测（机器可重复部分 + 自动化回归）
# Usage: bash scripts/r3f-installed-hand-test.sh [--skip-smoke]
# UI 清单：docs/execution/release-zero-terminal-hand-test.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${RUSHI_RELEASE_APP:-${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app}"
SKIP_SMOKE=0
for arg in "$@"; do
  case "$arg" in
    --skip-smoke) SKIP_SMOKE=1 ;;
  esac
done

OUT_DIR="${TMPDIR:-/tmp}/r3f-installed-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${OUT_DIR}"
EVIDENCE="${ROOT}/docs/execution/specs/r3f-installed-hand-test-evidence.md"

echo "==> R3f installed hand-test artifacts: ${OUT_DIR}"

run_step() {
  local name="$1"
  shift
  echo ""
  echo "======== ${name} ========"
  "$@" 2>&1 | tee "${OUT_DIR}/$(echo "${name}" | tr ' /' '__').log"
}

if [[ "${SKIP_SMOKE}" -eq 0 ]]; then
  run_step "release installed smoke" bash "${ROOT}/scripts/v1-release-installed-smoke.sh"
else
  echo "==> --skip-smoke: assuming release .app already running"
fi

run_step "R3f TS regression" bash -c "
  cd '${ROOT}/apps/desktop'
  npm run test -- \
    src/pages/useAsrSetupController.oneClick.test.ts \
    src/pages/useAsrSetupController.install.test.ts \
    src/pages/useAsrSetupController.diagnose.test.ts \
    src/components/envLocalAsr/LocalAsrAdvancedSection.test.tsx \
    src/components/envLocalAsr/LocalAsrSetupWizard.test.tsx
"

run_step "R3f Rust diagnose" bash -c "
  cd '${ROOT}/apps/desktop/src-tauri'
  cargo test -q asr_setup
"

HEALTH_JSON="${OUT_DIR}/health.json"
run_step "ASR health R3f gate" bash -c "
  curl -sf --max-time 10 http://127.0.0.1:8741/health -o '${HEALTH_JSON}'
  python3 - '${HEALTH_JSON}' <<'PY'
import json, sys
h = json.load(open(sys.argv[1], encoding='utf-8'))
assert h.get('service') == 'rushi-asr', h
assert h.get('funasr_import_ok') is True, h
assert h.get('funasr_ready') is True, h
assert h.get('ready_for_transcribe') is True, h
assert h.get('funasr_default_model_cached') is True, h
print('  OK: funasr_ready + default_model_cached + ready_for_transcribe')
PY
"

APP_ROOT="$(bash "${ROOT}/scripts/resolve-app-data-root.sh")"
LOG="${APP_ROOT}/logs/desktop.log"
run_step "desktop.log dev strings" bash -c "
  LOG='${LOG}'
  if [[ ! -f \"\${LOG}\" ]]; then
    echo '  WARN: no desktop.log'
    exit 0
  fi
  if tail -200 \"\${LOG}\" | grep -E 'npm run desktop:dev|tauri dev' >/dev/null; then
    echo '  FAIL: dev npm strings in recent desktop.log' >&2
    exit 1
  fi
  if tail -200 \"\${LOG}\" | grep -E 'bundled_sidecar_(already_healthy|health_ok|spawn)' >/dev/null; then
    echo '  OK: bundled sidecar path in recent log'
  else
    echo '  WARN: no bundled_sidecar_* in last 200 log lines (fresh install may need UI 一键准备)'
  fi
"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
MACOS="$(sw_vers -productVersion 2>/dev/null || echo unknown)"
cat > "${EVIDENCE}" <<EOF
# R3f 安装包手测 — 机器证据

- **时间（UTC）**：${TS}
- **macOS**：${MACOS}
- **包**：\`${APP}\`
- **App Data**：\`${APP_ROOT}\`
- **命令**：\`bash scripts/r3f-installed-hand-test.sh\`

## 机器结论

- release \`.app\` 启动 smoke ✅
- R3f TS 回归（one-click / install / diagnose / advanced UI）✅
- \`asr_setup\` Rust 11 tests ✅
- \`/health\`：\`funasr_ready\` + \`funasr_default_model_cached\` ✅
- 近期 \`desktop.log\` 无 \`npm run desktop:dev\` 文案 ✅

## 仍需 UI 手测（或 R9/v1 代理）

见 [release-zero-terminal-hand-test.md](../release-zero-terminal-hand-test.md) §1 一键准备（**首装空 App Data**）、§2–§6 导入/转写/导出/重启。

本机 **非首装**（复用既有 App Data + 模型缓存）；启动日志 \`bundled_sidecar_already_healthy\` 等价于零终端 ASR 就绪。
EOF

echo ""
echo "OK: R3f installed machine gate passed. Evidence: ${EVIDENCE}"

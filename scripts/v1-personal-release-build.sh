#!/usr/bin/env bash
# 个人单机 v1 — 发版打包（macOS 默认 .app + .dmg）
# 前置：R9 验收通过 · 可选侧车 bash scripts/build-asr-sidecar-unix.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

BUNDLE="${RUSHI_RELEASE_BUNDLE:-}" # 空 = tauri.conf targets (all)
SKIP_SIDEcar_CHECK="${RUSHI_SKIP_SIDECAR_CHECK:-0}"
OUT_NOTE="${ROOT}/docs/execution/v1-release-build-evidence.md"

echo "== v1 release preflight =="
npm run typecheck
npm run test -w @rushi/desktop
node scripts/check-architecture-guard.mjs
bash scripts/r9-rel-1-machine-gate.sh

if [[ "${SKIP_SIDEcar_CHECK}" -eq 0 ]]; then
  SIDECAR="${ROOT}/apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar"
  if [[ -x "${SIDECAR}" ]]; then
    echo "  bundled sidecar (source tree): ${SIDECAR}"
  else
    echo "  NOTE: source resources/ 无 onedir — 构建机若已有 sidecar 会打入 .app（见 installed-signoff）" >&2
  fi
fi

echo "== v1 release build (Tauri) =="
(
  cd apps/desktop
  if [[ -n "${BUNDLE}" ]]; then
    npm run tauri -- build --bundles "${BUNDLE}"
  else
    npm run tauri -- build
  fi
)

APP_GLOB="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/*.app"
DMG_GLOB="${ROOT}/apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "# v1 发版构建证据"
  echo ""
  echo "- **时间（UTC）**：${TS}"
  echo "- **版本**：\`$(node -p "require('./apps/desktop/package.json').version")\`"
  echo "- **门禁**：typecheck · vitest · architecture-guard · r9-rel-1-machine-gate"
  echo ""
  echo "## 产物"
  echo ""
  ls -lh ${APP_GLOB} 2>/dev/null || echo "(no .app — check bundle path)"
  ls -lh ${DMG_GLOB} 2>/dev/null || echo "(no .dmg — check bundle path)"
  echo ""
  echo "## 发版后手测（安装包）"
  echo ""
  echo "1. 安装/打开 `.app`，环境页完成本机 ASR（无 shell）。"
  echo "2. 打开既有项目 → 拉取语段 → 导出 Word。"
  echo "3. 质量概览可见 R4 摘要。"
} > "${OUT_NOTE}"

echo ""
echo "OK: v1 release build finished."
echo "Evidence: ${OUT_NOTE}"
ls -lh ${APP_GLOB} ${DMG_GLOB} 2>/dev/null || true

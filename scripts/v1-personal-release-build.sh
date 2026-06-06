#!/usr/bin/env bash
# 个人单机 v1 — 发版打包（默认 .app；DMG 可选）
# 前置：npm run asr:build-sidecar-unix · bash scripts/release-sidecar-preflight.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

BUNDLE="${RUSHI_RELEASE_BUNDLE:-app}"
SKIP_SIDECAR_CHECK="${RUSHI_SKIP_SIDECAR_CHECK:-0}"
OUT_NOTE="${ROOT}/docs/execution/v1-release-build-evidence.md"

echo "== v1 release preflight =="
npm run typecheck
npm run test -w @rushi/desktop
node scripts/check-architecture-guard.mjs
bash scripts/r9-rel-1-machine-gate.sh

if [[ "${SKIP_SIDECAR_CHECK}" -eq 0 ]]; then
  bash scripts/release-sidecar-preflight.sh
else
  echo "  SKIP: RUSHI_SKIP_SIDECAR_CHECK=1"
fi

AVAIL_GB="$(df -g . | awk 'NR==2 {print $4}')"
if [[ "${AVAIL_GB}" -lt 5 ]]; then
  echo "WARN: free disk ${AVAIL_GB}GB — DMG 打包建议 ≥5GB 可用空间" >&2
fi

bash scripts/release-cleanup-dmg-staging.sh

echo "== v1 release build (Tauri bundles=${BUNDLE}) =="
(
  cd apps/desktop
  npm run tauri -- build --bundles "${BUNDLE}"
)

APP_GLOB="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/"*.app
DMG_GLOB="${ROOT}/apps/desktop/src-tauri/target/release/bundle/dmg/"*.dmg
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "# v1 发版构建证据"
  echo ""
  echo "- **时间（UTC）**：${TS}"
  echo "- **版本**：\`$(node -p "require('./apps/desktop/package.json').version")\`"
  echo "- **门禁**：typecheck · vitest · architecture-guard · r9-rel-1 · release-sidecar-preflight"
  echo "- **bundles**：\`${BUNDLE}\`"
  echo ""
  echo "## 产物"
  echo ""
  ls -lh ${APP_GLOB} 2>/dev/null || echo "(no .app — check bundle path)"
  ls -lh ${DMG_GLOB} 2>/dev/null || echo "(no .dmg — 可仅发 .app 或检查磁盘/rw.*.dmg)"
  echo ""
  echo "## 说明"
  echo ""
  echo "- **侧车**在 \`.app/Contents/Resources/resources/bundled-asr/\`；**语音模型**在 App Data \`models/\`，不在安装包内。"
  echo "- 发版后机器冒烟：\`bash scripts/v1-release-installed-smoke.sh\`"
  echo ""
  echo "## 发版后手测（安装包）"
  echo ""
  echo "1. 安装/打开 \`.app\`，环境页「一键准备本机 ASR」（无 shell）。"
  echo "2. 导入音频 → 确认 \`projects/*/peaks/*.dat\` 生成 → 波形可见。"
  echo "3. 拉取语段 → 导出 Word。"
} > "${OUT_NOTE}"

echo ""
echo "OK: v1 release build finished."
echo "Evidence: ${OUT_NOTE}"
ls -lh ${APP_GLOB} ${DMG_GLOB} 2>/dev/null || true

if [[ "${BUNDLE}" == "app" || "${BUNDLE}" == *"app"* ]]; then
  bash scripts/release-postbuild-verify.sh
fi

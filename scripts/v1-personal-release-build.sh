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

if [[ "${RUSHI_SKIP_BUNDLED_MODELS_STAGE:-0}" -eq 0 ]]; then
  echo "== stage bundled ASR models (Plan B) =="
  npm run asr:stage-bundled-models
  bash scripts/preflight-bundled-asr-models.sh
else
  echo "  SKIP: RUSHI_SKIP_BUNDLED_MODELS_STAGE=1"
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
  echo "- **根目录安装包**：打包完成后 \`*.dmg\` 会复制到仓库根目录（\`scripts/stage-release-artifacts.sh\`）"
  echo ""
  echo "## 产物"
  echo ""
  ls -lh ${APP_GLOB} 2>/dev/null || echo "(no .app — check bundle path)"
  ls -lh ${DMG_GLOB} 2>/dev/null || echo "(no .dmg — 可仅发 .app 或检查磁盘/rw.*.dmg)"
  for app_path in ${APP_GLOB}; do
    [[ -d "${app_path}" ]] || continue
    bundled="${app_path}/Contents/Resources/resources/bundled-asr-models"
    if [[ -d "${bundled}" ]]; then
      echo ""
      echo "**bundled-asr-models in .app**: $(du -sh "${bundled}" | awk '{print $1}')"
    fi
  done
  for dmg_path in ${DMG_GLOB}; do
    [[ -f "${dmg_path}" ]] || continue
    echo "**DMG size**: $(du -sh "${dmg_path}" | awk '{print $1}') ($(stat -f%z "${dmg_path}" 2>/dev/null || stat -c%s "${dmg_path}" 2>/dev/null) bytes)"
  done
  echo ""
  echo "## 说明"
  echo ""
  echo "- **侧车**在 \`.app/Contents/Resources/resources/bundled-asr/\`；**默认语音模型**随包在 \`resources/bundled-asr-models/\`，首启 seed 至 App Data \`models/\`。"
  echo "- **Runtime manifest（可选）**：发 OTA / 瘦包前设置 \`RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL\` 再 build；见 [\`r3h-1-r-release-checklist.md\`](./specs/r3h-1-r-release-checklist.md)"
  echo "- 发版后机器冒烟：\`bash scripts/v1-release-installed-smoke.sh\`"
  echo ""
  echo "## 发版后手测（安装包）"
  echo ""
  echo "1. Fresh App Data 首启：全屏「正在准备内置语音模型…」→ seed 完成 → 断网可转写。"
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

bash scripts/stage-release-artifacts.sh || true

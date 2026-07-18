#!/usr/bin/env bash
# Local .app build for hand-test (Plan B bundled models; skips updater artifacts).
# Reuses local bundled-asr / bundled-asr-models when present (no sidecar rebuild, no ModelScope re-download).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

export RUSHI_SKIP_SIDECAR_SMOKE="${RUSHI_SKIP_SIDECAR_SMOKE:-1}"
export RUSHI_SKIP_BUNDLED_MODELS_STAGE_IF_PRESENT="${RUSHI_SKIP_BUNDLED_MODELS_STAGE_IF_PRESENT:-1}"

bash scripts/release-sidecar-preflight.sh
bash scripts/release-cleanup-dmg-staging.sh

if [[ "${RUSHI_SKIP_BUNDLED_MODELS_STAGE:-0}" -eq 0 ]]; then
  echo "== stage bundled ASR models (Plan B) =="
  npm run asr:stage-bundled-models
  bash scripts/preflight-bundled-asr-models.sh
else
  echo "  SKIP: RUSHI_SKIP_BUNDLED_MODELS_STAGE=1 (dev stub only — seed skipped at runtime)"
fi

echo "== Local hand-test build (.app only, createUpdaterArtifacts=false) =="
(
  cd apps/desktop
  npm run tauri -- build --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'
)

APP="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app"

# Repair linker-signed adhoc so LaunchServices / installed-smoke stay alive (P1-7).
if [[ "${RUSHI_SKIP_CODESIGN_REPAIR:-0}" != "1" ]] && command -v codesign >/dev/null 2>&1; then
  echo "== codesign repair (deep adhoc) =="
  codesign --force --deep --sign - "${APP}"
  echo "  OK: ${APP}"
fi

echo ""
echo "OK: ${APP}"
echo "Open: npm run desktop:open-release-app"

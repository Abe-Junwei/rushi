#!/usr/bin/env bash
# Local .app build for hand-test without TAURI_SIGNING_PRIVATE_KEY (skips updater artifacts).
# Release / OTA builds must use npm run desktop:build-app with signing secrets set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  echo "NOTE: TAURI_SIGNING_PRIVATE_KEY is set — use npm run desktop:build-app for signed updater artifacts."
fi

bash scripts/release-sidecar-preflight.sh
bash scripts/release-cleanup-dmg-staging.sh

echo "== Local hand-test build (.app only, createUpdaterArtifacts=false) =="
(
  cd apps/desktop
  npm run tauri -- build --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'
)

APP="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app"
echo ""
echo "OK: ${APP}"
echo "Open: npm run desktop:open-release-app"

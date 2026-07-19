#!/usr/bin/env bash
# Shared Windows release artifact basenames (Chinese product + version + role).
# Usage:
#   source scripts/rushi-win-release-artifact-names.sh
#   VERSION="$(rushi_win_app_version)"
#   echo "$(rushi_win_portable_zip_name "$VERSION")"
set -euo pipefail

rushi_win_product_name() {
  echo "如是我闻"
}

rushi_win_app_version() {
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  (cd "$root" && node -p "require('./apps/desktop/package.json').version")
}

# Strip leading v from tag-like input; pass through semver.
rushi_win_normalize_version() {
  local v="${1:-}"
  v="${v#v}"
  if [ -z "$v" ]; then
    rushi_win_app_version
  else
    echo "$v"
  fi
}

rushi_win_portable_zip_name() {
  # Deprecated (2026-07-19): portable retired; use rushi_win_offline_installer_zip_name.
  local version
  version="$(rushi_win_normalize_version "${1:-}")"
  echo "$(rushi_win_product_name)_${version}_Windows_x64_便携版.zip"
}

rushi_win_offline_installer_zip_name() {
  local version
  version="$(rushi_win_normalize_version "${1:-}")"
  echo "$(rushi_win_product_name)_${version}_Windows_x64_离线安装包.zip"
}

rushi_win_nsis_setup_name() {
  local version
  version="$(rushi_win_normalize_version "${1:-}")"
  echo "$(rushi_win_product_name)_${version}_Windows_x64_安装包.exe"
}

rushi_win_cuda_zip_name() {
  local version
  version="$(rushi_win_normalize_version "${1:-}")"
  echo "$(rushi_win_product_name)_${version}_Windows_x64_CUDA侧车.zip"
}

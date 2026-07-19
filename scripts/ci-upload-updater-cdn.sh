#!/usr/bin/env bash
# Upload release/OTA artifacts to Cloudflare R2 (S3-compatible). No GitHub Release assets.
# Requires: aws CLI v2, R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT [/ R2_BUCKET]
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  $0 --tag <vX.Y.Z> --mode macos-ota [--bundle-root PATH]
  $0 --tag <vX.Y.Z> --mode macos-dmg [--bundle-root PATH]
  $0 --tag <vX.Y.Z> --mode manifest --manifest-path PATH
  $0 --tag <vX.Y.Z> --mode windows-cuda --cuda-zip PATH [--runtime-manifest PATH]

Modes:
  macos-ota     app.tar.gz + .sig → CDN /<tag>/ (manifest merged separately)
  macos-dmg     *.dmg + *.sha256 → /<tag>/
  windows       如是我闻_*_离线安装包.zip(+sha) and optional NSIS → /<tag>/
  windows-ota   如是我闻_*_安装包.exe + .sig → CDN /<tag>/
  windows-cuda  CUDA sidecar zip(+sha) → /<tag>/; optional runtime manifest → /runtime/
  manifest      latest.json → CDN root + /<tag>/
EOF
  exit 1
}

TAG=""
MODE=""
BUNDLE_ROOT="apps/desktop/src-tauri/target/release/bundle"
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
BUCKET="${R2_BUCKET:-rushi-updates}"
MANIFEST_PATH=""
CUDA_ZIP=""
RUNTIME_MANIFEST=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --bundle-root)
      BUNDLE_ROOT="${2:-}"
      shift 2
      ;;
    --cdn-base)
      CDN_BASE="${2:-}"
      shift 2
      ;;
    --bucket)
      BUCKET="${2:-}"
      shift 2
      ;;
    --manifest-path)
      MANIFEST_PATH="${2:-}"
      shift 2
      ;;
    --cuda-zip)
      CUDA_ZIP="${2:-}"
      shift 2
      ;;
    --runtime-manifest)
      RUNTIME_MANIFEST="${2:-}"
      shift 2
      ;;
    -h | --help)
      usage
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      ;;
  esac
done

if [ -z "$TAG" ] || [ -z "$MODE" ]; then
  usage
fi

CDN_BASE="${CDN_BASE%/}"

# shellcheck source=scripts/ci-r2-env.sh
source "$(cd "$(dirname "$0")" && pwd)/ci-r2-env.sh"
BUCKET="${BUCKET:-$R2_BUCKET}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required for R2 upload." >&2
  exit 1
fi

S3=(aws --endpoint-url "$R2_ENDPOINT" s3)

# True if path contains non-ASCII (Windows aws.exe often mishandles Unicode local paths).
path_has_non_ascii() {
  local p="$1"
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import sys; sys.exit(0 if any(ord(c) > 127 for c in sys.argv[1]) else 1)' "$p"
    return $?
  fi
  # Fallback: byte length != character length under UTF-8 locale is unreliable; skip staging.
  return 1
}

upload_file() {
  local src="$1"
  local key="$2"
  local ctype="${3:-application/octet-stream}"
  if [ ! -f "$src" ]; then
    echo "Missing file: $src" >&2
    exit 1
  fi
  local upload_src="$src"
  local staged=""
  if path_has_non_ascii "$src"; then
    staged="$(mktemp "${TMPDIR:-/tmp}/rushi-r2-XXXXXX.bin")"
    cp "$src" "$staged"
    upload_src="$staged"
    echo "ci-upload: staged ASCII temp for Unicode local path → key=${key}"
  fi
  echo "→ s3://${BUCKET}/${key}"
  "${S3[@]}" cp "$upload_src" "s3://${BUCKET}/${key}" --content-type "$ctype"
  if [ -n "$staged" ]; then
    rm -f "$staged"
  fi
}

case "$MODE" in
  macos-ota)
    MACOS_DIR="${BUNDLE_ROOT}/macos"
    TAR_GZ="${MACOS_DIR}/app.tar.gz"
    SIG_FILE="${TAR_GZ}.sig"
    upload_file "$TAR_GZ" "${TAG}/app.tar.gz" "application/gzip"
    upload_file "$SIG_FILE" "${TAG}/app.tar.gz.sig" "text/plain"
    echo "CDN package:     ${CDN_BASE}/${TAG}/app.tar.gz"
    ;;
  macos-dmg)
    shopt -s nullglob
    dmg_files=("${BUNDLE_ROOT}/dmg/"*.dmg)
    if [ ${#dmg_files[@]} -eq 0 ]; then
      echo "No DMG files under ${BUNDLE_ROOT}/dmg/" >&2
      exit 1
    fi
    for dmg in "${dmg_files[@]}"; do
      base="$(basename "$dmg")"
      upload_file "$dmg" "${TAG}/${base}" "application/x-apple-diskimage"
      if [ -f "${dmg}.sha256" ]; then
        upload_file "${dmg}.sha256" "${TAG}/${base}.sha256" "text/plain"
      fi
    done
    echo "CDN DMG: ${CDN_BASE}/${TAG}/"
    ;;
  windows)
    ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    # shellcheck source=scripts/rushi-win-release-artifact-names.sh
    source "$ROOT/scripts/rushi-win-release-artifact-names.sh"
    APP_VER="$(rushi_win_app_version)"
    OFFLINE_NAME="$(rushi_win_offline_installer_zip_name "$APP_VER")"
    NSIS_NAME="$(rushi_win_nsis_setup_name "$APP_VER")"
    OFFLINE_SOURCE=""
    OFFLINE_SHA=""
    if [ -f "${ROOT}/windows-offline-x64.zip" ]; then
      OFFLINE_SOURCE="${ROOT}/windows-offline-x64.zip"
      OFFLINE_SHA="${ROOT}/windows-offline-x64.zip.sha256"
    elif [ -f "${ROOT}/${OFFLINE_NAME}" ]; then
      OFFLINE_SOURCE="${ROOT}/${OFFLINE_NAME}"
      OFFLINE_SHA="${ROOT}/${OFFLINE_NAME}.sha256"
    fi
    NSIS_SOURCE="${BUNDLE_ROOT}/nsis/${NSIS_NAME}"
    NSIS_SHA="${NSIS_SOURCE}.sha256"
    for required in "$OFFLINE_SOURCE" "$OFFLINE_SHA" "$NSIS_SOURCE" "$NSIS_SHA"; do
      if [ -z "$required" ] || [ ! -f "$required" ]; then
        echo "Missing required Windows core release file: ${required:-offline zip}" >&2
        echo "Refusing a partial CDN upload." >&2
        exit 1
      fi
    done
    uploaded=0
    # Prefer ASCII local alias (CI writes windows-offline-x64.zip); S3 key stays Chinese.
    if [ -f "${ROOT}/windows-offline-x64.zip" ]; then
      upload_file "${ROOT}/windows-offline-x64.zip" "${TAG}/${OFFLINE_NAME}" "application/zip"
      uploaded=1
      upload_file "$OFFLINE_SHA" "${TAG}/${OFFLINE_NAME}.sha256" "text/plain"
    elif [ -f "${ROOT}/${OFFLINE_NAME}" ]; then
      upload_file "${ROOT}/${OFFLINE_NAME}" "${TAG}/${OFFLINE_NAME}" "application/zip"
      uploaded=1
      upload_file "$OFFLINE_SHA" "${TAG}/${OFFLINE_NAME}.sha256" "text/plain"
    fi
    shopt -s nullglob
    if [ -f "${BUNDLE_ROOT}/nsis/${NSIS_NAME}" ]; then
      # ASCII local staging for aws.exe; CDN key remains Chinese product name.
      NSIS_ASCII="${BUNDLE_ROOT}/nsis/rushi-win-nsis-upload.exe"
      cp "${BUNDLE_ROOT}/nsis/${NSIS_NAME}" "$NSIS_ASCII"
      upload_file "$NSIS_ASCII" "${TAG}/${NSIS_NAME}" "application/vnd.microsoft.portable-executable"
      rm -f "$NSIS_ASCII"
      uploaded=1
      upload_file "$NSIS_SHA" "${TAG}/${NSIS_NAME}.sha256" "text/plain"
    else
      nsis_files=("${BUNDLE_ROOT}/nsis/"*.exe)
      for exe in "${nsis_files[@]}"; do
        base="$(basename "$exe")"
        case "$base" in
          *.sig) continue ;;
        esac
        upload_file "$exe" "${TAG}/${base}" "application/vnd.microsoft.portable-executable"
        uploaded=1
        if [ -f "${exe}.sha256" ]; then
          upload_file "${exe}.sha256" "${TAG}/${base}.sha256" "text/plain"
        fi
      done
    fi
    if [ "$uploaded" -eq 0 ]; then
      echo "No Windows release files found to upload." >&2
      exit 1
    fi
    echo "CDN Windows: ${CDN_BASE}/${TAG}/"
    ;;
  windows-ota)
    ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    # shellcheck source=scripts/rushi-win-release-artifact-names.sh
    source "$ROOT/scripts/rushi-win-release-artifact-names.sh"
    APP_VER="$(rushi_win_app_version)"
    NSIS_NAME="$(rushi_win_nsis_setup_name "$APP_VER")"
    NSIS_DIR="${BUNDLE_ROOT}/nsis"
    SETUP_EXE="${NSIS_DIR}/${NSIS_NAME}"
    SIG_FILE="${SETUP_EXE}.sig"
    NSIS_ASCII="${NSIS_DIR}/rushi-win-nsis-upload.exe"
    cp "$SETUP_EXE" "$NSIS_ASCII"
    upload_file "$NSIS_ASCII" "${TAG}/${NSIS_NAME}" "application/vnd.microsoft.portable-executable"
    rm -f "$NSIS_ASCII"
    upload_file "$SIG_FILE" "${TAG}/${NSIS_NAME}.sig" "text/plain"
    echo "CDN Windows OTA: ${CDN_BASE}/${TAG}/${NSIS_NAME}"
    ;;
  windows-cuda)
    if [ -z "$CUDA_ZIP" ] || [ ! -f "$CUDA_ZIP" ]; then
      echo "Missing --cuda-zip for mode=windows-cuda" >&2
      exit 1
    fi
    base="$(basename "$CUDA_ZIP")"
    upload_file "$CUDA_ZIP" "${TAG}/${base}" "application/zip"
    if [ -f "${CUDA_ZIP}.sha256" ]; then
      upload_file "${CUDA_ZIP}.sha256" "${TAG}/${base}.sha256" "text/plain"
    fi
    # Runtime manifest primary URL uses ASCII alias; upload same bytes under that key.
    CUDA_ASCII_NAME="rushi-asr-sidecar-cuda-windows-x64.zip"
    if [ "$base" != "$CUDA_ASCII_NAME" ]; then
      CUDA_DIR="$(dirname "$CUDA_ZIP")"
      CUDA_ASCII_LOCAL="${CUDA_DIR}/${CUDA_ASCII_NAME}"
      if [ ! -f "$CUDA_ASCII_LOCAL" ]; then
        # Prefer hardlink; fall back to cp for cross-device paths.
        ln "$CUDA_ZIP" "$CUDA_ASCII_LOCAL" 2>/dev/null || cp "$CUDA_ZIP" "$CUDA_ASCII_LOCAL"
      fi
      upload_file "$CUDA_ASCII_LOCAL" "${TAG}/${CUDA_ASCII_NAME}" "application/zip"
      if [ -f "${CUDA_ASCII_LOCAL}.sha256" ]; then
        upload_file "${CUDA_ASCII_LOCAL}.sha256" "${TAG}/${CUDA_ASCII_NAME}.sha256" "text/plain"
      elif [ -f "${CUDA_ZIP}.sha256" ]; then
        # Rewrite checksum line to ASCII basename for clients that verify by filename.
        hash_line="$(tr -s '[:space:]' ' ' <"${CUDA_ZIP}.sha256" | cut -d' ' -f1)"
        printf '%s  %s\n' "$hash_line" "$CUDA_ASCII_NAME" >"${CUDA_ASCII_LOCAL}.sha256"
        upload_file "${CUDA_ASCII_LOCAL}.sha256" "${TAG}/${CUDA_ASCII_NAME}.sha256" "text/plain"
      fi
      echo "CDN Windows CUDA ASCII alias: ${CDN_BASE}/${TAG}/${CUDA_ASCII_NAME}"
    fi
    if [ -n "$RUNTIME_MANIFEST" ]; then
      if [ ! -f "$RUNTIME_MANIFEST" ]; then
        echo "Missing runtime manifest: $RUNTIME_MANIFEST" >&2
        exit 1
      fi
      upload_file "$RUNTIME_MANIFEST" "runtime/rushi-runtime-manifest.json" "application/json"
      upload_file "$RUNTIME_MANIFEST" "${TAG}/rushi-runtime-manifest.json" "application/json"
      echo "CDN runtime manifest: ${CDN_BASE}/runtime/rushi-runtime-manifest.json"
    fi
    echo "CDN Windows CUDA: ${CDN_BASE}/${TAG}/${base}"
    ;;
  manifest)
    MANIFEST="${MANIFEST_PATH:-}"
    if [ -z "$MANIFEST" ] || [ ! -f "$MANIFEST" ]; then
      echo "Missing --manifest-path for mode=manifest" >&2
      exit 1
    fi
    upload_file "$MANIFEST" "latest.json" "application/json"
    upload_file "$MANIFEST" "${TAG}/latest.json" "application/json"
    echo "CDN latest.json: ${CDN_BASE}/latest.json"
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    usage
    ;;
esac

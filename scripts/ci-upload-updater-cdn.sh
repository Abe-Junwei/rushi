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
  windows       windows-portable-x64.zip(+sha) and optional NSIS → /<tag>/
  windows-ota   rushi-desktop-setup.exe + .sig → CDN /<tag>/
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

if [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ] || [ -z "${R2_ENDPOINT:-}" ]; then
  echo "Missing R2 credentials. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required for R2 upload." >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${R2_REGION:-auto}"
export AWS_EC2_METADATA_DISABLED=true
# awscli 2.23+ default checksums break many S3-compatible backends (R2).
export AWS_REQUEST_CHECKSUM_CALCULATION="${AWS_REQUEST_CHECKSUM_CALCULATION:-when_required}"
export AWS_RESPONSE_CHECKSUM_VALIDATION="${AWS_RESPONSE_CHECKSUM_VALIDATION:-when_required}"

S3=(aws --endpoint-url "$R2_ENDPOINT" s3)

upload_file() {
  local src="$1"
  local key="$2"
  local ctype="${3:-application/octet-stream}"
  if [ ! -f "$src" ]; then
    echo "Missing file: $src" >&2
    exit 1
  fi
  echo "→ s3://${BUCKET}/${key}"
  "${S3[@]}" cp "$src" "s3://${BUCKET}/${key}" --content-type "$ctype"
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
    uploaded=0
    if [ -f "${ROOT}/windows-portable-x64.zip" ]; then
      upload_file "${ROOT}/windows-portable-x64.zip" "${TAG}/windows-portable-x64.zip" "application/zip"
      uploaded=1
      if [ -f "${ROOT}/windows-portable-x64.zip.sha256" ]; then
        upload_file "${ROOT}/windows-portable-x64.zip.sha256" "${TAG}/windows-portable-x64.zip.sha256" "text/plain"
      fi
    fi
    shopt -s nullglob
    if [ -f "${BUNDLE_ROOT}/nsis/rushi-desktop-setup.exe" ]; then
      upload_file "${BUNDLE_ROOT}/nsis/rushi-desktop-setup.exe" "${TAG}/rushi-desktop-setup.exe" "application/vnd.microsoft.portable-executable"
      uploaded=1
      if [ -f "${BUNDLE_ROOT}/nsis/rushi-desktop-setup.exe.sha256" ]; then
        upload_file "${BUNDLE_ROOT}/nsis/rushi-desktop-setup.exe.sha256" "${TAG}/rushi-desktop-setup.exe.sha256" "text/plain"
      fi
    else
      nsis_files=("${BUNDLE_ROOT}/nsis/"*-setup.exe)
      for exe in "${nsis_files[@]}"; do
        base="$(basename "$exe")"
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
    NSIS_DIR="${BUNDLE_ROOT}/nsis"
    SETUP_EXE="${NSIS_DIR}/rushi-desktop-setup.exe"
    SIG_FILE="${SETUP_EXE}.sig"
    upload_file "$SETUP_EXE" "${TAG}/rushi-desktop-setup.exe" "application/vnd.microsoft.portable-executable"
    upload_file "$SIG_FILE" "${TAG}/rushi-desktop-setup.exe.sig" "text/plain"
    echo "CDN Windows OTA: ${CDN_BASE}/${TAG}/rushi-desktop-setup.exe"
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

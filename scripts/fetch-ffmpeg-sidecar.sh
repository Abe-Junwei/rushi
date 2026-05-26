#!/usr/bin/env bash
# Download ffmpeg + ffprobe static binaries for sidecar bundling (ffmpeg-static release).
# Usage: bash scripts/fetch-ffmpeg-sidecar.sh <target>
#   target: darwin-arm64 | darwin-x64 | win32-x64 | linux-x64
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="b6.1.1"
BASE="https://github.com/eugeneware/ffmpeg-static/releases/download/${TAG}"

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "usage: $0 <darwin-arm64|darwin-x64|win32-x64|linux-x64>" >&2
  exit 2
fi

case "$target" in
  darwin-arm64|darwin-x64|win32-x64|linux-x64) ;;
  *) echo "unknown target: $target" >&2; exit 2 ;;
esac

OUT="$ROOT/services/asr/third_party/ffmpeg/$target"
mkdir -p "$OUT"

case "$target" in
  darwin-arm64|darwin-x64|linux-x64)
    ffmpeg_bin="ffmpeg"
    ffprobe_bin="ffprobe"
    ;;
  win32-x64)
    ffmpeg_bin="ffmpeg.exe"
    ffprobe_bin="ffprobe.exe"
    ;;
esac

if [[ "${FORCE_FFMPEG_FETCH:-0}" != "1" && -x "$OUT/$ffmpeg_bin" && -x "$OUT/$ffprobe_bin" ]]; then
  echo "OK: ffmpeg already cached -> $OUT (set FORCE_FFMPEG_FETCH=1 to re-download)"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl_retry() {
  local url="$1"
  local out="$2"
  local attempt=1
  local max=4
  while (( attempt <= max )); do
    if curl -fsSL --connect-timeout 30 --max-time 600 -o "$out" "$url"; then
      return 0
    fi
    echo "curl failed (attempt $attempt/$max): $url" >&2
    attempt=$((attempt + 1))
    sleep $((attempt * 5))
  done
  return 1
}

fetch() {
  local name="$1"
  local out_name="$2"
  curl_retry "$BASE/$name" "$TMP/$name"
  install -m0755 "$TMP/$name" "$OUT/$out_name"
}

case "$target" in
  darwin-arm64)
    fetch "ffmpeg-darwin-arm64" "ffmpeg"
    fetch "ffprobe-darwin-arm64" "ffprobe"
    curl_retry "$BASE/darwin-arm64.LICENSE" "$OUT/LICENSE.ffmpeg-static"
    ;;
  darwin-x64)
    fetch "ffmpeg-darwin-x64" "ffmpeg"
    fetch "ffprobe-darwin-x64" "ffprobe"
    curl_retry "$BASE/darwin-x64.LICENSE" "$OUT/LICENSE.ffmpeg-static"
    ;;
  win32-x64)
    fetch "ffmpeg-win32-x64" "ffmpeg.exe"
    fetch "ffprobe-win32-x64" "ffprobe.exe"
    curl_retry "$BASE/win32-x64.LICENSE" "$OUT/LICENSE.ffmpeg-static"
    ;;
  linux-x64)
    fetch "ffmpeg-linux-x64" "ffmpeg"
    fetch "ffprobe-linux-x64" "ffprobe"
    curl_retry "$BASE/linux-x64.LICENSE" "$OUT/LICENSE.ffmpeg-static"
    ;;
esac

echo "OK: ffmpeg binaries -> $OUT"

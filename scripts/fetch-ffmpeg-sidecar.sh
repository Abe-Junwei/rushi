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
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fetch() {
  local name="$1"
  local out_name="$2"
  curl -fsSL -o "$TMP/$name" "$BASE/$name"
  install -m0755 "$TMP/$name" "$OUT/$out_name"
}

case "$target" in
  darwin-arm64)
    fetch "ffmpeg-darwin-arm64" "ffmpeg"
    fetch "ffprobe-darwin-arm64" "ffprobe"
    curl -fsSL -o "$OUT/LICENSE.ffmpeg-static" "$BASE/darwin-arm64.LICENSE"
    ;;
  darwin-x64)
    fetch "ffmpeg-darwin-x64" "ffmpeg"
    fetch "ffprobe-darwin-x64" "ffprobe"
    curl -fsSL -o "$OUT/LICENSE.ffmpeg-static" "$BASE/darwin-x64.LICENSE"
    ;;
  win32-x64)
    fetch "ffmpeg-win32-x64" "ffmpeg.exe"
    fetch "ffprobe-win32-x64" "ffprobe.exe"
    curl -fsSL -o "$OUT/LICENSE.ffmpeg-static" "$BASE/win32-x64.LICENSE"
    ;;
  linux-x64)
    fetch "ffmpeg-linux-x64" "ffmpeg"
    fetch "ffprobe-linux-x64" "ffprobe"
    curl -fsSL -o "$OUT/LICENSE.ffmpeg-static" "$BASE/linux-x64.LICENSE"
    ;;
esac

echo "OK: ffmpeg binaries -> $OUT"

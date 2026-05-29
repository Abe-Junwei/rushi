#!/usr/bin/env bash
# Build PyInstaller onedir for rushi-asr sidecar and copy into Tauri resources.
#
# - macOS: FunASR + CPU torch (per lock) + bundled ffmpeg-static; Python 3.12 + network.
# - Linux x86_64: FunASR + CPU torch via `requirements-sidecar-cpu-linux_x86_64.lock` + linux-x64 ffmpeg-static.
# - Other Unix: minimal stub (FastAPI only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASR="$ROOT/services/asr"
DEST="$ROOT/apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar"
TMPVENV="$ASR/.venv-sidecar-build"

command -v python3 >/dev/null 2>&1 || {
  echo "python3 not found" >&2
  exit 1
}

OS="$(uname -s)"
ARCH="$(uname -m)"

build_stub() {
  echo "Building stub sidecar (no FunASR / lock)."
  rm -rf "$TMPVENV"
  python3 -m venv "$TMPVENV"
  # shellcheck source=/dev/null
  source "$TMPVENV/bin/activate"
  python -m pip install -U pip
  python -m pip install pyinstaller
  python -m pip install -e "$ASR"
  cd "$ASR"
  rm -rf build dist rushi-asr-sidecar.spec
  pyinstaller --noconfirm --clean --onedir --name rushi-asr-sidecar \
    --hidden-import=uvicorn.logging \
    --hidden-import=uvicorn.loops \
    --hidden-import=uvicorn.loops.auto \
    --hidden-import=uvicorn.protocols \
    --hidden-import=uvicorn.protocols.http \
    --hidden-import=uvicorn.protocols.http.auto \
    --hidden-import=uvicorn.lifespan \
    --hidden-import=uvicorn.lifespan.on \
    rushi_sidecar_entry.py
  rm -rf "$DEST"
  mkdir -p "$(dirname "$DEST")"
  cp -R "$ASR/dist/rushi-asr-sidecar" "$DEST"
  echo "OK (stub): $DEST"
}

build_funasr() {
  local ffmpeg_target="$1"
  local lock_file="$2"
  bash "$ROOT/scripts/fetch-ffmpeg-sidecar.sh" "$ffmpeg_target"
  local ffdir="$ASR/third_party/ffmpeg/$ffmpeg_target"

  rm -rf "$TMPVENV"
  python3 -m venv "$TMPVENV"
  # shellcheck source=/dev/null
  source "$TMPVENV/bin/activate"
  python -m pip install -U pip setuptools wheel
  python -m pip install pyinstaller
  python -m pip install -r "$lock_file"
  python -m pip install -e "$ASR" --no-deps

  cd "$ASR"
  rm -rf build dist rushi-asr-sidecar.spec

  pyinstaller --noconfirm --clean --onedir --name rushi-asr-sidecar \
    --add-binary "$ffdir/ffmpeg:." \
    --add-binary "$ffdir/ffprobe:." \
    --hidden-import=uvicorn.logging \
    --hidden-import=uvicorn.loops \
    --hidden-import=uvicorn.loops.auto \
    --hidden-import=uvicorn.protocols \
    --hidden-import=uvicorn.protocols.http \
    --hidden-import=uvicorn.protocols.http.auto \
    --hidden-import=uvicorn.lifespan \
    --hidden-import=uvicorn.lifespan.on \
    --hidden-import=funasr \
    --collect-all funasr \
    --collect-all jieba \
    --collect-data modelscope \
    --collect-submodules modelscope \
    --collect-submodules hydra \
    --collect-submodules omegaconf \
    --collect-submodules torchaudio \
    rushi_sidecar_entry.py

  ensure_funasr_onedir_data "$ASR/dist/rushi-asr-sidecar/_internal"

  bash "$ROOT/scripts/smoke-asr-sidecar-health.sh" "$ASR/dist/rushi-asr-sidecar/rushi-asr-sidecar"

  rm -rf "$DEST"
  mkdir -p "$(dirname "$DEST")"
  cp -R "$ASR/dist/rushi-asr-sidecar" "$DEST"
  echo "OK: FunASR sidecar onedir -> $DEST"
}

# PyInstaller may place funasr only in PYZ without package data on disk; /health needs version.txt.
ensure_funasr_onedir_data() {
  local internal="$1"
  local marker="$internal/funasr/version.txt"
  if [[ -f "$marker" ]]; then
    return 0
  fi
  echo "WARN: $marker missing after PyInstaller; copying funasr from build venv" >&2
  local site
  site="$(python -c 'import funasr, pathlib; print(pathlib.Path(funasr.__file__).resolve().parent)')"
  rm -rf "$internal/funasr"
  mkdir -p "$internal/funasr"
  cp -R "$site/." "$internal/funasr/"
  if [[ ! -f "$marker" ]]; then
    echo "FATAL: funasr package data still missing at $marker" >&2
    exit 1
  fi
}

if [[ "$OS" == Linux && "$ARCH" == x86_64 ]]; then
  build_funasr "linux-x64" "$ASR/requirements-sidecar-cpu-linux_x86_64.lock"
  exit 0
fi

if [[ "$OS" != Darwin ]]; then
  build_stub
  exit 0
fi

case "$ARCH" in
  arm64) FFMPEG_TARGET="darwin-arm64"; LOCK="$ASR/requirements-sidecar-cpu-macos-arm64.lock" ;;
  x86_64) FFMPEG_TARGET="darwin-x64"; LOCK="$ASR/requirements-sidecar-cpu-macos-x86_64.lock" ;;
  *)
    echo "unsupported macOS arch: $ARCH" >&2
    exit 1
    ;;
esac

build_funasr "$FFMPEG_TARGET" "$LOCK"

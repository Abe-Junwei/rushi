Bundled ASR sidecar (optional)
==============================

If this folder contains a PyInstaller onedir named:

  rushi-asr-sidecar/rushi-asr-sidecar       (macOS)
  rushi-asr-sidecar/rushi-asr-sidecar.exe   (Windows CPU)

the desktop app will start it on launch when http://127.0.0.1:8741/health is not
already reachable, and stop it on exit.

Windows release installers ship **CPU only**. An optional CUDA onedir may be
downloaded later into App Data (`bundled-asr/rushi-asr-sidecar-cuda/`) when an
NVIDIA driver is detected. Local/dev builds may still place CUDA under resources:

  rushi-asr-sidecar-cuda/rushi-asr-sidecar-cuda.exe   (Windows CUDA torch)

On Windows, when an NVIDIA driver + nvidia-smi are present, the shell tries the
CUDA onedir first (App Data or resources), then falls back to CPU if health does
not come up. Set RUSHI_FORCE_BUNDLED_ASR_CPU=1 to skip CUDA selection.

Layout (onedir):

- Main executable at the path above.
- **`ffmpeg`** and **`ffprobe`** live under `_internal/` (PyInstaller onedir; from ffmpeg-static).
  The shell prepends `_internal` to `PATH` when spawning the sidecar so FunASR can invoke `ffmpeg`.
- Python runtime and libraries under `_internal/`.

Build from the repo root:

  macOS:   bash scripts/build-asr-sidecar-unix.sh   (arm64 / x86_64 FunASR + CPU torch + lockfile)
  Windows: powershell -File scripts/build-asr-sidecar-windows.ps1
           powershell -File scripts/build-asr-sidecar-windows.ps1 -Variant Cuda

Prerequisites: **Python 3.12**, network for pip. Regenerate Python locks:
`npm run asr:regen-sidecar-locks`.

Then run a normal Tauri build. Set RUSHI_SKIP_BUNDLED_ASR=1 to force-disable.

The desktop shell sets RUSHI_MODELS_ROOT (under app data …/studio.lingchuang.rushi/models/)
and hub cache env vars for the sidecar. Under Plan B (v0.1.8+), default Paraformer weights are
seeded from resources/bundled-asr-models/ on first launch; non-default models may still download
from ModelScope when explicitly selected.

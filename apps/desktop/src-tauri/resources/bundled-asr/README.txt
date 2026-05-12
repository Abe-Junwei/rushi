Bundled ASR sidecar (optional)
==============================

If this folder contains a PyInstaller onedir named:

  rushi-asr-sidecar/rushi-asr-sidecar       (macOS / Linux)
  rushi-asr-sidecar/rushi-asr-sidecar.exe   (Windows CPU)

and on Windows optionally a second onedir:

  rushi-asr-sidecar-cuda/rushi-asr-sidecar-cuda.exe   (Windows CUDA torch)

the desktop app will start one of them on launch when http://127.0.0.1:8741/health is not
already reachable, and stop it on exit. On Windows, when an NVIDIA driver + nvidia-smi
are present, the shell tries the CUDA bundle first (if built), then falls back to CPU
if health does not come up. Set RUSHI_FORCE_BUNDLED_ASR_CPU=1 to skip CUDA selection.

Layout (onedir):

- Main executable at the path above; **`ffmpeg`** and **`ffprobe`** sit next to it
  (from ffmpeg-static; see `services/asr/third_party/ffmpeg/README.md`).
- Python runtime and libraries under `_internal/`.

Build from the repo root:

  macOS:   bash scripts/build-asr-sidecar-unix.sh   (arm64 / x86_64 FunASR + CPU torch + lockfile)
  Linux:   same script — currently builds a **small stub** only (no FunASR lock for Linux yet)
  Windows: powershell -File scripts/build-asr-sidecar-windows.ps1
           powershell -File scripts/build-asr-sidecar-windows.ps1 -Variant Cuda

Prerequisites: **Python 3.12**, network for pip. Regenerate Python locks:
`npm run asr:regen-sidecar-locks`.

Then run a normal Tauri build. Set RUSHI_SKIP_BUNDLED_ASR=1 to force-disable.

The desktop shell sets RUSHI_MODELS_ROOT (under app data …/studio.lingchuang.rushi/models/)
and hub cache env vars for the sidecar so FunASR weights download there on first use.

#!/usr/bin/env bash
# Package bundled sidecar onedir into an OTA zip (rushi-asr-sidecar/ as zip root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${1:-${ROOT}/apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar}"
OUT_DIR="${2:-${ROOT}/dist}"

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "ERROR: sidecar directory not found: ${SOURCE_DIR}" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

python3 - "${SOURCE_DIR}" "${OUT_DIR}" <<'PY'
import platform
import sys
import zipfile
from pathlib import Path

source_dir = Path(sys.argv[1]).resolve()
out_dir = Path(sys.argv[2]).resolve()

os_map = {"Darwin": "darwin", "Linux": "linux", "Windows": "windows"}
arch_map = {"x86_64": "x64", "AMD64": "x64", "arm64": "arm64", "aarch64": "arm64"}
platform_key = (
    f"{os_map.get(platform.system(), platform.system().lower())}-"
    f"{arch_map.get(platform.machine(), platform.machine())}"
)

zip_path = out_dir / f"rushi-asr-sidecar-{platform_key}.zip"
if zip_path.exists():
    zip_path.unlink()

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(source_dir.rglob("*")):
        arcname = Path(source_dir.name) / path.relative_to(source_dir)
        if path.is_dir():
            zf.writestr(str(arcname).rstrip("/") + "/", "")
        else:
            zf.write(path, arcname)

print(f"platform_key={platform_key}")
print(f"zip_path={zip_path.as_posix()}")
PY

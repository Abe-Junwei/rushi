#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${1:-$ROOT/apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar}"
OUT_ROOT="${2:-$ROOT/fixtures/local-runtime}"
CARGO_TOML="$ROOT/apps/desktop/src-tauri/Cargo.toml"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "source sidecar directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_ROOT"

python3 - "$SOURCE_DIR" "$OUT_ROOT" "$CARGO_TOML" <<'PY'
import hashlib
import base64
import json
import os
import platform
import shutil
import sys
import tempfile
import tomllib
import zipfile
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

source_dir = Path(sys.argv[1]).resolve()
out_root = Path(sys.argv[2]).resolve()
cargo_toml = Path(sys.argv[3]).resolve()
fixture_key_id = "rushi-runtime-fixture-v1"
fixture_private_key = bytes.fromhex("93c68519a9caa35b3d667513e02fc64e4117ab7483321f9ac92cea336a6c5ade")

with cargo_toml.open("rb") as f:
    cargo = tomllib.load(f)

shell_version = cargo["package"]["version"]

os_map = {
    "Darwin": "darwin",
    "Linux": "linux",
    "Windows": "windows",
}
arch_map = {
    "x86_64": "x64",
    "AMD64": "x64",
    "arm64": "arm64",
    "aarch64": "arm64",
}
platform_key = f"{os_map.get(platform.system(), platform.system().lower())}-{arch_map.get(platform.machine(), platform.machine())}"

fixture_root = out_root / platform_key
healthy_dir = fixture_root / "healthy"
corrupt_dir = fixture_root / "corrupt-missing-funasr-version"
healthy_dir.mkdir(parents=True, exist_ok=True)
corrupt_dir.mkdir(parents=True, exist_ok=True)

def zip_directory(source: Path, target: Path) -> None:
    if target.exists():
        target.unlink()
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(source.rglob("*")):
            arcname = Path(source.name) / path.relative_to(source)
            if path.is_dir():
                zf.writestr(str(arcname).rstrip("/") + "/", "")
            else:
                zf.write(path, arcname)

def sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def manifest_for(zip_path: Path, sha256: str) -> dict:
    exe_name = "rushi-asr-sidecar.exe" if platform.system() == "Windows" else "rushi-asr-sidecar"
    payload = {
        "manifest_version": 1,
        "published_at": "2026-05-26T00:00:00Z",
        "components": [
            {
                "id": "asr-sidecar",
                "version": shell_version,
                "platform": platform_key,
                "artifact": {
                    "url": zip_path.as_uri(),
                    "sha256": sha256,
                    "size_bytes": zip_path.stat().st_size,
                    "format": "zip-onedir",
                },
                "exe_relpath": f"rushi-asr-sidecar/{exe_name}",
                "min_shell_version": shell_version,
                "mirror_urls": [],
            }
        ],
    }
    payload_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    signature = Ed25519PrivateKey.from_private_bytes(fixture_private_key).sign(payload_bytes)
    return {
        **payload,
        "signature": {
            "key_id": fixture_key_id,
            "algorithm": "ed25519",
            "signature": base64.b64encode(signature).decode("ascii"),
        },
    }

with tempfile.TemporaryDirectory(prefix="rushi-local-runtime-fixtures-") as temp_dir_str:
    temp_dir = Path(temp_dir_str)

    healthy_copy = temp_dir / "healthy" / source_dir.name
    healthy_copy.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_dir, healthy_copy)

    corrupt_copy = temp_dir / "corrupt" / source_dir.name
    corrupt_copy.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_dir, corrupt_copy)
    corrupt_marker = corrupt_copy / "_internal" / "funasr" / "version.txt"
    if not corrupt_marker.exists():
        raise SystemExit(f"expected bundled FunASR marker missing: {corrupt_marker}")
    corrupt_marker.unlink()

    healthy_zip = healthy_dir / f"rushi-asr-sidecar-{platform_key}-healthy.zip"
    corrupt_zip = corrupt_dir / f"rushi-asr-sidecar-{platform_key}-corrupt-missing-funasr-version.zip"
    zip_directory(healthy_copy, healthy_zip)
    zip_directory(corrupt_copy, corrupt_zip)

    healthy_manifest = healthy_dir / "rushi-runtime-manifest.json"
    corrupt_manifest = corrupt_dir / "rushi-runtime-manifest.json"
    healthy_manifest.write_text(
        json.dumps(manifest_for(healthy_zip, sha256_hex(healthy_zip)), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    corrupt_manifest.write_text(
        json.dumps(manifest_for(corrupt_zip, sha256_hex(corrupt_zip)), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

print("Prepared local runtime fixtures:")
print(f"  healthy manifest: {healthy_manifest}")
print(f"  corrupt manifest: {corrupt_manifest}")
print()
print("Use one of these before launching the desktop app:")
print(f'  export RUSHI_LOCAL_RUNTIME_MANIFEST_URL="{healthy_manifest.as_uri()}"')
print(f'  export RUSHI_LOCAL_RUNTIME_MANIFEST_URL="{corrupt_manifest.as_uri()}"')
print('  export RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST="1"')
PY

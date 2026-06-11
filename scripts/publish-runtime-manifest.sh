#!/usr/bin/env bash
# Build a signed rushi-runtime-manifest.json for LRC sidecar OTA / app-data install.
# Release signing key stays outside the repo (CI secret or local keychain export).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CARGO_TOML="${ROOT}/apps/desktop/src-tauri/Cargo.toml"

usage() {
  cat <<'EOF'
Usage: publish-runtime-manifest.sh --zip PATH --artifact-url HTTPS_URL [--output DIR] [--key-id ID]

Required:
  --zip PATH              Sidecar onedir zip (local file to hash)
  --artifact-url URL      HTTPS URL where the zip will be hosted (manifest artifact.url)

Optional:
  --output DIR            Output directory (default: ./dist/runtime-manifest)
  --key-id ID             Signature key id (default: rushi-runtime-release-v1)
  --min-shell-version V   min_shell_version (default: desktop Cargo.toml version)
  --sidecar-version V     Component version (default: same as min-shell-version)
  --dev-fixture           Sign with local fixture key (debug/tests only)

Environment:
  RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX   Ed25519 private key (64 hex chars) — required unless --dev-fixture

Example (release):
  export RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX="<secret>"
  bash scripts/publish-runtime-manifest.sh \
    --zip dist/rushi-asr-sidecar-darwin-arm64.zip \
    --artifact-url "https://example.com/rushi/runtime/v0.1.0/rushi-asr-sidecar-darwin-arm64.zip"

Example (local fixture — matches prepare-local-runtime-fixtures.sh):
  bash scripts/publish-runtime-manifest.sh --dev-fixture \
    --zip fixtures/local-runtime/darwin-arm64/healthy/rushi-asr-sidecar-darwin-arm64-healthy.zip \
    --artifact-url "file:///tmp/asr.zip"
EOF
}

ZIP_PATH=""
ARTIFACT_URL=""
OUTPUT_DIR="${ROOT}/dist/runtime-manifest"
KEY_ID="rushi-runtime-release-v1"
MIN_SHELL_VERSION=""
SIDECAR_VERSION=""
DEV_FIXTURE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zip) ZIP_PATH="$2"; shift 2 ;;
    --artifact-url) ARTIFACT_URL="$2"; shift 2 ;;
    --output) OUTPUT_DIR="$2"; shift 2 ;;
    --key-id) KEY_ID="$2"; shift 2 ;;
    --min-shell-version) MIN_SHELL_VERSION="$2"; shift 2 ;;
    --sidecar-version) SIDECAR_VERSION="$2"; shift 2 ;;
    --dev-fixture) DEV_FIXTURE=1; KEY_ID="rushi-runtime-fixture-v1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "${ZIP_PATH}" || -z "${ARTIFACT_URL}" ]]; then
  echo "ERROR: --zip and --artifact-url are required." >&2
  usage
  exit 1
fi

if [[ ! -f "${ZIP_PATH}" ]]; then
  echo "ERROR: zip not found: ${ZIP_PATH}" >&2
  exit 1
fi

if [[ "${DEV_FIXTURE}" -eq 0 && -z "${RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX:-}" ]]; then
  echo "ERROR: set RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX or pass --dev-fixture." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

python3 - "${ZIP_PATH}" "${ARTIFACT_URL}" "${OUTPUT_DIR}" "${CARGO_TOML}" "${KEY_ID}" "${MIN_SHELL_VERSION}" "${SIDECAR_VERSION}" "${DEV_FIXTURE}" <<'PY'
import base64
import hashlib
import json
import os
import platform
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

zip_path = Path(sys.argv[1]).resolve()
artifact_url = sys.argv[2]
output_dir = Path(sys.argv[3]).resolve()
cargo_toml = Path(sys.argv[4]).resolve()
key_id = sys.argv[5]
min_shell_override = sys.argv[6].strip()
sidecar_version_override = sys.argv[7].strip()
dev_fixture = sys.argv[8] == "1"

with cargo_toml.open("rb") as f:
    shell_version = tomllib.load(f)["package"]["version"]

min_shell_version = min_shell_override or shell_version
sidecar_version = sidecar_version_override or shell_version

os_map = {"Darwin": "darwin", "Linux": "linux", "Windows": "windows"}
arch_map = {"x86_64": "x64", "AMD64": "x64", "arm64": "arm64", "aarch64": "arm64"}
platform_key = f"{os_map.get(platform.system(), platform.system().lower())}-{arch_map.get(platform.machine(), platform.machine())}"

exe_name = "rushi-asr-sidecar.exe" if platform.system() == "Windows" else "rushi-asr-sidecar"

def sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

if dev_fixture:
    private_key_hex = "93c68519a9caa35b3d667513e02fc64e4117ab7483321f9ac92cea336a6c5ade"
else:
    private_key_hex = os.environ["RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX"].strip()

private_key = bytes.fromhex(private_key_hex)
signing_key = Ed25519PrivateKey.from_private_bytes(private_key)

payload = {
    "manifest_version": 1,
    "published_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "components": [
        {
            "id": "asr-sidecar",
            "version": sidecar_version,
            "platform": platform_key,
            "artifact": {
                "url": artifact_url,
                "sha256": sha256_hex(zip_path),
                "size_bytes": zip_path.stat().st_size,
                "format": "zip-onedir",
            },
            "exe_relpath": f"rushi-asr-sidecar/{exe_name}",
            "min_shell_version": min_shell_version,
            "mirror_urls": [],
        }
    ],
}

payload_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
signature = signing_key.sign(payload_bytes)
signed = {
    **payload,
    "signature": {
        "key_id": key_id,
        "algorithm": "ed25519",
        "signature": base64.b64encode(signature).decode("ascii"),
    },
}

manifest_path = output_dir / "rushi-runtime-manifest.json"
manifest_path.write_text(json.dumps(signed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

meta_path = output_dir / "publish-meta.json"
meta_path.write_text(
    json.dumps(
        {
            "platform": platform_key,
            "zip_path": str(zip_path),
            "artifact_url": artifact_url,
            "sha256": payload["components"][0]["artifact"]["sha256"],
            "size_bytes": payload["components"][0]["artifact"]["size_bytes"],
            "key_id": key_id,
            "sidecar_version": sidecar_version,
            "min_shell_version": min_shell_version,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

print(f"Wrote manifest: {manifest_path}")
print(f"Wrote meta:     {meta_path}")
print(f"Platform:       {platform_key}")
print(f"SHA256:         {payload['components'][0]['artifact']['sha256']}")
print()
print("Next:")
print("  1) Upload zip to the HTTPS artifact-url")
print("  2) Upload rushi-runtime-manifest.json next to it (or stable channel path)")
print("  3) Build desktop with:")
print('     RUSHI_DEFAULT_LOCAL_RUNTIME_MANIFEST_URL="<https://.../rushi-runtime-manifest.json>" npm run desktop:build-dmg')
PY

#!/usr/bin/env bash
# Build + Ed25519-sign a runtime manifest that lists the Windows CUDA sidecar component.
# Requires: python3, cryptography (pip), RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX (64 hex chars = 32-byte seed)
# Output: dist/runtime-manifest/rushi-runtime-manifest.json (+ publish-meta.json)
#
# Paths passed to Python must be relative (or Windows-native). Git Bash absolute paths
# like /d/a/... are not reliable with native Windows python.exe (ENOENT on open).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG=""
ZIP=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
OUT_DIR="dist/runtime-manifest"
KEY_ID="rushi-runtime-release-v1"
COMPONENT_VERSION=""
MIN_SHELL_VERSION=""

usage() {
  cat >&2 <<'EOF'
Usage:
  $0 --tag vX.Y.Z --zip PATH/to/rushi-asr-sidecar-cuda-windows-x64.zip
     [--cdn-base URL] [--component-version VER] [--min-shell-version VER]
EOF
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --zip) ZIP="${2:-}"; shift 2 ;;
    --cdn-base) CDN_BASE="${2:-}"; shift 2 ;;
    --component-version) COMPONENT_VERSION="${2:-}"; shift 2 ;;
    --min-shell-version) MIN_SHELL_VERSION="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

if [ -z "$TAG" ] || [ -z "$ZIP" ]; then
  usage
fi

# Normalize zip to a path relative to ROOT when possible (Python-friendly on Windows).
case "$ZIP" in
  /*|[A-Za-z]:*)
    if command -v cygpath >/dev/null 2>&1; then
      ZIP="$(cygpath -u "$ZIP")"
    fi
    ZIP="${ZIP#"$ROOT"/}"
    ;;
esac
if [ ! -f "$ZIP" ]; then
  echo "Missing zip: $ZIP (cwd=$ROOT)" >&2
  exit 1
fi
if [ -z "${RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX:-}" ]; then
  echo "Missing RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX" >&2
  exit 1
fi

CDN_BASE="${CDN_BASE%/}"
# Primary URL stays ASCII (download clients + aws-friendly). Product Chinese zip is a mirror.
# Manual/CI CDN must upload BOTH keys with identical bytes.
ARTIFACT_NAME="rushi-asr-sidecar-cuda-windows-x64.zip"
ARTIFACT_URL="${CDN_BASE}/${TAG}/${ARTIFACT_NAME}"
PRODUCT_ZIP_NAME="$(basename "$ZIP")"
PRODUCT_ZIP_URL="${CDN_BASE}/${TAG}/${PRODUCT_ZIP_NAME}"
COMPONENT_VERSION="${COMPONENT_VERSION:-${TAG#v}}"
MIN_SHELL_VERSION="${MIN_SHELL_VERSION:-${TAG#v}}"

mkdir -p "$OUT_DIR"
UNSIGNED_JSON="${OUT_DIR}/.unsigned-cuda-manifest.json"
SIGNED_JSON="${OUT_DIR}/rushi-runtime-manifest.json"
META_JSON="${OUT_DIR}/publish-meta.json"

# Hash + size via Python so we never depend on sha256sum/wc path quirks on Windows runners.
eval "$(
  python3 - "$ZIP" <<'PY'
import hashlib, os, sys
path = sys.argv[1]
h = hashlib.sha256()
size = 0
with open(path, "rb") as f:
  while True:
    chunk = f.read(1024 * 1024)
    if not chunk:
      break
    h.update(chunk)
    size += len(chunk)
print(f"SHA256={h.hexdigest()}")
print(f"SIZE_BYTES={size}")
PY
)"
PUBLISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

export RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX
python3 - <<PY
import base64, json, os
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

unsigned_path = r"""${UNSIGNED_JSON}"""
signed_path = r"""${SIGNED_JSON}"""
meta_path = r"""${META_JSON}"""

payload = {
  "manifest_version": 1,
  "published_at": "${PUBLISHED_AT}",
  "components": [{
    "id": "asr-sidecar-cuda",
    "version": "${COMPONENT_VERSION}",
    "platform": "windows-x86_64",
    "artifact": {
      "url": "${ARTIFACT_URL}",
      "sha256": "${SHA256}",
      "size_bytes": int("${SIZE_BYTES}"),
      "format": "zip-onedir"
    },
    "exe_relpath": "rushi-asr-sidecar-cuda/rushi-asr-sidecar-cuda.exe",
    "min_shell_version": "${MIN_SHELL_VERSION}",
    "mirror_urls": ["${PRODUCT_ZIP_URL}"]
  }]
}

# Match Rust serde_json::Value (BTreeMap) canonicalization used by the verifier.
os.makedirs(os.path.dirname(signed_path) or ".", exist_ok=True)
with open(unsigned_path, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

key_hex = os.environ["RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX"].strip()
seed = bytes.fromhex(key_hex)
if len(seed) != 32:
  raise SystemExit(f"signing key must be 32 bytes, got {len(seed)}")
private_key = Ed25519PrivateKey.from_private_bytes(seed)

with open(unsigned_path, "rb") as f:
  canonical = f.read()
signature = private_key.sign(canonical)
signed = json.loads(canonical.decode("utf-8"))
signed["signature"] = {
  "key_id": "rushi-runtime-release-v1",
  "algorithm": "ed25519",
  "signature": base64.b64encode(signature).decode("ascii"),
}
with open(signed_path, "w", encoding="utf-8") as f:
  json.dump(signed, f, ensure_ascii=False, indent=2, sort_keys=True)
  f.write("\n")

meta = {
  "tag": "${TAG}",
  "artifact_url": "${ARTIFACT_URL}",
  "sha256": "${SHA256}",
  "size_bytes": int("${SIZE_BYTES}"),
  "component_id": "asr-sidecar-cuda",
  "platform": "windows-x86_64",
  "key_id": "${KEY_ID}",
  "manifest_path": signed_path,
}
with open(meta_path, "w", encoding="utf-8") as f:
  json.dump(meta, f, indent=2)
  f.write("\n")

os.remove(unsigned_path)
print(f"Signed manifest: {signed_path}")
print(f"CDN artifact URL: ${ARTIFACT_URL}")
print(f"sha256: ${SHA256}")
print(f"size_bytes: ${SIZE_BYTES}")
PY

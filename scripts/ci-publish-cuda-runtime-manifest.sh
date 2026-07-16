#!/usr/bin/env bash
# Build + Ed25519-sign a runtime manifest that lists the Windows CUDA sidecar component.
# Requires: python3, cryptography (pip), RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX (64 hex chars = 32-byte seed)
# Output: dist/runtime-manifest/rushi-runtime-manifest.json (+ .publish-meta.json)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG=""
ZIP=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"
OUT_DIR="${ROOT}/dist/runtime-manifest"
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
if [ ! -f "$ZIP" ]; then
  echo "Missing zip: $ZIP" >&2
  exit 1
fi
if [ -z "${RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX:-}" ]; then
  echo "Missing RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX" >&2
  exit 1
fi

CDN_BASE="${CDN_BASE%/}"
ARTIFACT_NAME="rushi-asr-sidecar-cuda-windows-x64.zip"
ARTIFACT_URL="${CDN_BASE}/${TAG}/${ARTIFACT_NAME}"
COMPONENT_VERSION="${COMPONENT_VERSION:-${TAG#v}}"
MIN_SHELL_VERSION="${MIN_SHELL_VERSION:-${TAG#v}}"

mkdir -p "$OUT_DIR"
SHA256="$(sha256sum "$ZIP" | awk '{print $1}')"
SIZE_BYTES="$(wc -c <"$ZIP" | tr -d ' ')"
PUBLISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

UNSIGNED_JSON="$(mktemp)"
SIGNED_JSON="${OUT_DIR}/rushi-runtime-manifest.json"
META_JSON="${OUT_DIR}/publish-meta.json"

python3 - "$UNSIGNED_JSON" <<PY
import json, sys
out = sys.argv[1]
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
    "mirror_urls": []
  }]
}
# Match Rust serde_json::Value (BTreeMap) canonicalization used by the verifier.
with open(out, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
PY

python3 - "$UNSIGNED_JSON" "$SIGNED_JSON" <<'PY'
import base64, json, os, sys
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

unsigned_path, signed_path = sys.argv[1], sys.argv[2]
key_hex = os.environ["RUSHI_RUNTIME_MANIFEST_SIGNING_KEY_HEX"].strip()
seed = bytes.fromhex(key_hex)
if len(seed) != 32:
  raise SystemExit(f"signing key must be 32 bytes, got {len(seed)}")
private_key = Ed25519PrivateKey.from_private_bytes(seed)

with open(unsigned_path, "rb") as f:
  canonical = f.read()
signature = private_key.sign(canonical)
payload = json.loads(canonical.decode("utf-8"))
payload["signature"] = {
  "key_id": "rushi-runtime-release-v1",
  "algorithm": "ed25519",
  "signature": base64.b64encode(signature).decode("ascii"),
}
# Pretty output for humans; verifier re-canonicalizes via serde after stripping signature.
with open(signed_path, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
  f.write("\n")
PY

python3 - "$META_JSON" <<PY
import json
meta = {
  "tag": "${TAG}",
  "artifact_url": "${ARTIFACT_URL}",
  "sha256": "${SHA256}",
  "size_bytes": int("${SIZE_BYTES}"),
  "component_id": "asr-sidecar-cuda",
  "platform": "windows-x86_64",
  "key_id": "${KEY_ID}",
  "manifest_path": "${SIGNED_JSON}",
}
with open("${META_JSON}", "w", encoding="utf-8") as f:
  json.dump(meta, f, indent=2)
  f.write("\n")
PY

rm -f "$UNSIGNED_JSON"
echo "Signed manifest: $SIGNED_JSON"
echo "CDN artifact URL: $ARTIFACT_URL"
echo "sha256: $SHA256"
echo "size_bytes: $SIZE_BYTES"

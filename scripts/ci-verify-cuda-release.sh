#!/usr/bin/env bash
# Verify the published Windows CUDA runtime manifest and artifact after the optional CUDA job.
set -euo pipefail

TAG=""
CDN_BASE="${RUSHI_UPDATER_CDN_BASE:-https://updates.rushi.app}"

usage() {
  echo "Usage: $0 --tag vX.Y.Z [--cdn-base URL]" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --cdn-base) CDN_BASE="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
  usage
fi

CDN_BASE="${CDN_BASE%/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/rushi-win-release-artifact-names.sh"
VERSION="${TAG#v}"
PRODUCT_NAME="$(rushi_win_cuda_zip_name "$VERSION")"
MANIFEST_URL="${CDN_BASE}/runtime/rushi-runtime-manifest.json"
PRIMARY_URL="${CDN_BASE}/${TAG}/rushi-asr-sidecar-cuda-windows-x64.zip"
MIRROR_URL="${CDN_BASE}/${TAG}/${PRODUCT_NAME}"

encode_url() {
  node -e 'console.log(encodeURI(process.argv[1]))' "$1"
}

MANIFEST="$(curl -fsSL "$(encode_url "$MANIFEST_URL")")"
mapfile -t manifest_fields < <(
  printf '%s' "$MANIFEST" | node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const manifest = JSON.parse(input);
      const component = (manifest.components || []).find(
        (item) => item.id === "asr-sidecar-cuda" && item.platform === "windows-x86_64",
      );
      if (!component) process.exit(2);
      const signature = manifest.signature || {};
      console.log(component.version || "");
      console.log(component.artifact?.url || "");
      console.log((component.artifact?.sha256 || "").toLowerCase());
      console.log((component.mirror_urls || []).includes(process.argv[1]) ? "true" : "false");
      console.log(
        signature.algorithm === "ed25519" && signature.key_id && signature.signature
          ? "true"
          : "false",
      );
    });
  ' "$MIRROR_URL"
)
if [ ${#manifest_fields[@]} -ne 5 ]; then
  echo "CUDA runtime manifest has no complete windows-x86_64 asr-sidecar-cuda component." >&2
  exit 1
fi
manifest_version="${manifest_fields[0]}"
artifact_url="${manifest_fields[1]}"
expected_sha="${manifest_fields[2]}"
mirror_ok="${manifest_fields[3]}"
signature_ok="${manifest_fields[4]}"

if [ "$manifest_version" != "$VERSION" ]; then
  echo "CUDA manifest version mismatch: expected $VERSION, got $manifest_version" >&2
  exit 1
fi
if [ "$artifact_url" != "$PRIMARY_URL" ]; then
  echo "CUDA manifest primary URL mismatch: expected $PRIMARY_URL, got $artifact_url" >&2
  exit 1
fi
if [[ ! "$expected_sha" =~ ^[0-9a-f]{64}$ ]]; then
  echo "CUDA manifest SHA256 is missing or invalid: $expected_sha" >&2
  exit 1
fi
if [ "$mirror_ok" != "true" ] || [ "$signature_ok" != "true" ]; then
  echo "CUDA manifest mirror URL or signature metadata is incomplete." >&2
  exit 1
fi

mirror_code="$(curl -fsSIL "$(encode_url "$MIRROR_URL")" | awk 'BEGIN{s=0} /^HTTP/{s=$2} END{print s}')"
if [ "$mirror_code" != "200" ]; then
  echo "CUDA product mirror is not reachable (HTTP $mirror_code): $MIRROR_URL" >&2
  exit 1
fi

actual_sha="$(curl -fsSL "$(encode_url "$PRIMARY_URL")" | sha256sum | awk '{print tolower($1)}')"
if [ "$actual_sha" != "$expected_sha" ]; then
  echo "CUDA CDN SHA256 mismatch: expected $expected_sha, got $actual_sha" >&2
  exit 1
fi

echo "CUDA CDN verified: version=$VERSION sha256=$actual_sha"

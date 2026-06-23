#!/usr/bin/env bash
# Upload Windows release assets, respecting GitHub Release 2 GiB per-file limit.
# Files >= limit are uploaded as workflow artifacts; release gets checksum + OFFSITE note.
set -euo pipefail

TAG=""
BUNDLE_ROOT="apps/desktop/src-tauri/target/release/bundle"
# GitHub: size must be < 2147483648 bytes
GITHUB_MAX_RELEASE_BYTES=$((2 * 1024 * 1024 * 1024 - 1))
OFFSITE_MANIFEST="windows-portable-OFFSITE.md"
OFFSITE_DIR=".ci-windows-offsite"

usage() {
  echo "Usage: $0 --tag <vX.Y.Z> [--bundle-root PATH]" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --bundle-root)
      BUNDLE_ROOT="${2:-}"
      shift 2
      ;;
    -h | --help)
      usage
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      ;;
  esac
done

if [ -z "$TAG" ]; then
  usage
fi

if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GH_TOKEN or GITHUB_TOKEN is required." >&2
  exit 1
fi

file_size_bytes() {
  local path="$1"
  if stat --version >/dev/null 2>&1; then
    stat -c '%s' "$path"
  else
    stat -f '%z' "$path"
  fi
}

human_size() {
  local bytes="$1"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec-i --suffix=B "$bytes"
  else
    echo "${bytes} bytes"
  fi
}

shopt -s nullglob
candidates=( windows-portable-x64.zip )
nsis=( "${BUNDLE_ROOT}/nsis/"*-setup.exe )
if [ ${#nsis[@]} -gt 0 ]; then
  candidates+=( "${nsis[@]}" )
else
  echo "::warning::NSIS installer missing; portable zip only."
fi

release_upload=()
offsite_upload=()
rm -rf "$OFFSITE_DIR"
mkdir -p "$OFFSITE_DIR"

for file in "${candidates[@]}"; do
  [ -f "$file" ] || continue
  size="$(file_size_bytes "$file")"
  sha_file="${file}.sha256"
  if [ -f "$sha_file" ]; then
    release_upload+=( "$sha_file" )
  fi
  if [ "$size" -le "$GITHUB_MAX_RELEASE_BYTES" ]; then
    release_upload+=( "$file" )
    echo "Release upload: $(basename "$file") ($(human_size "$size"))"
  else
    echo "::warning::$(basename "$file") is $(human_size "$size") — exceeds GitHub Release 2 GiB limit; using workflow artifact."
    cp -f "$file" "$OFFSITE_DIR/"
    if [ -f "$sha_file" ]; then
      cp -f "$sha_file" "$OFFSITE_DIR/"
    fi
    offsite_upload+=( "$file" )
  fi
done

if [ ${#offsite_upload[@]} -gt 0 ]; then
  {
    echo "# Windows portable download (off-site)"
    echo ""
    echo "GitHub Release 单文件上限 **2 GiB**。以下资产超过上限，请从 **Actions workflow artifacts** 下载（Release tag \`${TAG}\` 对应 run 的 \`windows-offsite-bundles\`）。"
    echo ""
    echo "| 文件 | SHA256 |"
    echo "|------|--------|"
    for file in "${offsite_upload[@]}"; do
      base="$(basename "$file")"
      if [ -f "${file}.sha256" ]; then
        hash="$(awk '{print $1}' "${file}.sha256")"
      else
        hash="(missing .sha256)"
      fi
      echo "| \`${base}\` | \`${hash}\` |"
    done
    echo ""
    echo "校验：\`certutil -hashfile ${base} SHA256\`（PowerShell）或对照上表。"
  } > "$OFFSITE_MANIFEST"
  release_upload+=( "$OFFSITE_MANIFEST" )
fi

if [ ${#release_upload[@]} -gt 0 ]; then
  gh release upload "$TAG" "${release_upload[@]}" --clobber
fi

echo "Windows release upload complete."

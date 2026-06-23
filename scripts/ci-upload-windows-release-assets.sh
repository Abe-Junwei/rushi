#!/usr/bin/env bash
# Upload Windows release assets, respecting GitHub Release 2 GiB per-file limit.
# Files over the limit are split into <2 GiB parts and uploaded to the same Release.
set -euo pipefail

TAG=""
BUNDLE_ROOT="apps/desktop/src-tauri/target/release/bundle"
# GitHub: size must be < 2147483648 bytes
GITHUB_MAX_RELEASE_BYTES=$((2 * 1024 * 1024 * 1024 - 1))
# Headroom under 2 GiB for split parts (compressed artifact overhead not applicable to release upload).
SPLIT_CHUNK_BYTES=$((1800 * 1024 * 1024))
SPLIT_MANIFEST="windows-portable-SPLIT.md"
SPLIT_DIR=".ci-windows-split"

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

write_split_manifest() {
  local manifest="$1"
  shift
  local files=("$@")

  {
    echo "# Windows portable download (split parts)"
    echo ""
    echo "GitHub Release 单文件上限 **2 GiB**。以下安装包已拆成多个 part 文件（均 <2 GiB），下载**全部 part** 后合并为 zip，再解压运行。"
    echo ""
    echo "## 文件与校验"
    echo ""
    echo "| 合并后文件 | SHA256 | Part 文件 |"
    echo "|------------|--------|-----------|"
    for file in "${files[@]}"; do
      base="$(basename "$file")"
      if [ -f "${file}.sha256" ]; then
        hash="$(awk '{print $1}' "${file}.sha256")"
      else
        hash="(missing .sha256)"
      fi
      shopt -s nullglob
      parts=( "${SPLIT_DIR}/${base}.part-"* )
      part_names=""
      for part in "${parts[@]}"; do
        part_names+="\`$(basename "$part")\`, "
      done
      part_names="${part_names%, }"
      echo "| \`${base}\` | \`${hash}\` | ${part_names} |"
    done
    echo ""
    echo "## 合并（PowerShell，推荐）"
    echo ""
    echo '```powershell'
    echo '$base = "windows-portable-x64.zip"'
    echo '$parts = Get-ChildItem "$base.part-*" | Sort-Object Name'
    echo '$out = [System.IO.File]::Create($base)'
    echo 'try {'
    echo '  foreach ($p in $parts) {'
    echo '    $in = [System.IO.File]::OpenRead($p.FullName)'
    echo '    try { $in.CopyTo($out) } finally { $in.Close() }'
    echo '  }'
    echo '} finally { $out.Close() }'
    echo '```'
    echo ""
    echo "## 合并（cmd）"
    echo ""
    echo "在 part 所在目录执行（按文件名排序拼接）："
    echo ""
    echo '```bat'
    echo "copy /b windows-portable-x64.zip.part-aa+windows-portable-x64.zip.part-ab+... windows-portable-x64.zip"
    echo '```'
    echo ""
    echo "合并后校验：\`certutil -hashfile windows-portable-x64.zip SHA256\`"
  } > "$manifest"
}

split_for_release() {
  local file="$1"
  local base="$(basename "$file")"
  local size="$2"

  if ! command -v split >/dev/null 2>&1; then
    echo "::error::coreutils split is required to upload $(basename "$file") ($(human_size "$size"))" >&2
    exit 1
  fi

  mkdir -p "$SPLIT_DIR"
  echo "::warning::$(basename "$file") is $(human_size "$size") — exceeds GitHub Release 2 GiB limit; uploading split parts."

  split -b "$SPLIT_CHUNK_BYTES" "$file" "${SPLIT_DIR}/${base}.part-"

  shopt -s nullglob
  local parts=( "${SPLIT_DIR}/${base}.part-"* )
  if [ ${#parts[@]} -eq 0 ]; then
    echo "::error::split produced no parts for ${base}" >&2
    exit 1
  fi

  for part in "${parts[@]}"; do
    local part_size
    part_size="$(file_size_bytes "$part")"
    if [ "$part_size" -gt "$GITHUB_MAX_RELEASE_BYTES" ]; then
      echo "::error::split part still exceeds GitHub limit: $(basename "$part") ($(human_size "$part_size"))" >&2
      exit 1
    fi
    release_upload+=( "$part" )
    echo "Release upload (split part): $(basename "$part") ($(human_size "$part_size"))"
  done

  split_sources+=( "$file" )
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
split_sources=()
rm -rf "$SPLIT_DIR"

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
    split_for_release "$file" "$size"
  fi
done

if [ ${#split_sources[@]} -gt 0 ]; then
  write_split_manifest "$SPLIT_MANIFEST" "${split_sources[@]}"
  release_upload+=( "$SPLIT_MANIFEST" )
fi

if [ ${#release_upload[@]} -eq 0 ]; then
  echo "::error::No Windows release assets to upload." >&2
  exit 1
fi

gh release upload "$TAG" "${release_upload[@]}" --clobber

echo "Windows release upload complete."

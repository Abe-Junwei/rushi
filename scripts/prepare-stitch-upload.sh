#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/docs/stitch-upload"

mkdir -p "$TARGET_DIR"

copy_file() {
  local source_path="$1"
  local target_name="$2"

  if [[ ! -f "$ROOT_DIR/$source_path" ]]; then
    echo "[prepare-stitch-upload] missing source: $source_path" >&2
    exit 1
  fi

  cp "$ROOT_DIR/$source_path" "$TARGET_DIR/$target_name"
}

copy_file "DESIGN.md" "01-DESIGN.md"
# 01-DESIGN.md 为根 DESIGN.md 的副本；编辑设计系统请只改仓库根 DESIGN.md。
copy_file "docs/execution/specs/ui-redesign-parallel-dev.md" "02-ui-redesign-parallel-dev.md"
copy_file "apps/desktop/docs/stitch-welcome-page-spec.md" "03-stitch-welcome-page-spec.md"
copy_file "apps/desktop/docs/stitch-work-page-spec.md" "04-stitch-work-page-spec.md"
copy_file "apps/desktop/docs/stitch-waveform-polish-spec.md" "19-stitch-waveform-polish-spec.md"
copy_file "apps/desktop/stitch-waveform-polish-layout.html" "20-stitch-waveform-polish-layout.html"
copy_file "apps/desktop/docs/stitch-environment-llm-panel-spec.md" "21-stitch-environment-llm-panel-spec.md"
copy_file "apps/desktop/stitch-environment-llm-layout.html" "22-stitch-environment-llm-layout.html"
copy_file "apps/desktop/docs/stitch-welcome-hub-unified-spec.md" "23-stitch-welcome-hub-unified-spec.md"
copy_file "apps/desktop/stitch-welcome-hub-layout.html" "24-stitch-welcome-hub-layout.html"
copy_file "apps/desktop/stitch-welcome-page-full.png" "05-stitch-welcome-page-full.png"

# Fix relative links after copying docs from apps/desktop/docs into docs/stitch-upload.
sed -i '' 's#(../src/components/ProjectPanel.tsx)#(../../apps/desktop/src/components/ProjectPanel.tsx)#g' "$TARGET_DIR/03-stitch-welcome-page-spec.md"
sed -i '' 's#(../tailwind.config.js)#(../../apps/desktop/tailwind.config.js)#g' "$TARGET_DIR/03-stitch-welcome-page-spec.md"

sed -i '' 's#(./stitch-welcome-page-spec.md)#(./03-stitch-welcome-page-spec.md)#g' "$TARGET_DIR/04-stitch-work-page-spec.md"
sed -i '' 's#(../src/components/ProjectPanel.tsx)#(../../apps/desktop/src/components/ProjectPanel.tsx)#g' "$TARGET_DIR/04-stitch-work-page-spec.md"

echo "[prepare-stitch-upload] done: $TARGET_DIR"
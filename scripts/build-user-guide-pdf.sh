#!/usr/bin/env bash
# 从 Markdown 生成安装包内嵌 PDF（Tauri bundle resources）。
# 优先 wkhtmltopdf（CI 常用）；否则尝试 xelatex + 中文字体；均失败则保留已有 PDF（由仓库提交）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MD="$ROOT/apps/desktop/src-tauri/resources/user-guide-zh.md"
OUT="$ROOT/apps/desktop/src-tauri/resources/user-guide-zh.pdf"
if [[ ! -f "$MD" ]]; then
  echo "missing $MD" >&2
  exit 1
fi
mkdir -p "$(dirname "$OUT")"

try_pandoc() {
  pandoc "$MD" -o "$OUT" "$@" 2>/dev/null
}

if command -v pandoc >/dev/null 2>&1; then
  if command -v wkhtmltopdf >/dev/null 2>&1 && try_pandoc --pdf-engine=wkhtmltopdf -V papersize=a4; then
    echo "OK: $OUT (wkhtmltopdf)"
    exit 0
  fi
  if command -v xelatex >/dev/null 2>&1; then
    for font in "PingFang SC" "Songti SC" "STSong" "Noto Sans CJK SC" "Noto Serif CJK SC"; do
      if try_pandoc --pdf-engine=xelatex -V CJKmainfont="$font" -V documentclass=article; then
        echo "OK: $OUT (xelatex + $font)"
        exit 0
      fi
    done
  fi
  echo "warn: pandoc could not build PDF (install pandoc + wkhtmltopdf, or TeX + CJK font)" >&2
else
  echo "warn: pandoc not in PATH" >&2
fi

if [[ -f "$OUT" ]]; then
  echo "OK: using existing committed $OUT"
  exit 0
fi
echo "error: no PDF engine and no existing $OUT" >&2
exit 1

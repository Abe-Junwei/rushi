#!/usr/bin/env python3
"""Extract normalized plain text from a .docx for eval CER reference."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_via_textutil(docx: Path) -> str:
    r = subprocess.run(
        ["textutil", "-convert", "txt", "-stdout", str(docx)],
        capture_output=True,
        text=True,
        check=False,
    )
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout
    return ""


def extract_via_zip(docx: Path) -> str:
    with zipfile.ZipFile(docx) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    parts: list[str] = []
    for node in root.iter(f"{W_NS}t"):
        if node.text:
            parts.append(node.text)
        if node.tail:
            parts.append(node.tail)
    return "".join(parts)


def normalize_reference(text: str) -> str:
    return re.sub(r"\s+", "", text.strip())


def main() -> int:
    ap = argparse.ArgumentParser(description="Docx → normalized eval reference .txt")
    ap.add_argument("--docx", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    docx = args.docx.expanduser().resolve()
    if not docx.is_file():
        print(f"docx not found: {docx}", file=sys.stderr)
        return 2
    raw = extract_via_textutil(docx)
    if not raw.strip():
        raw = extract_via_zip(docx)
    if not raw.strip():
        print("empty extract from docx", file=sys.stderr)
        return 1
    out = normalize_reference(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(out + "\n", encoding="utf-8")
    print(f"wrote {len(out)} chars → {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Seed Rushi app DB project「对照」from D3 eval artifacts."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = Path.home() / "Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi"
DB_PATH = APP_ROOT / "rushi.sqlite3"
EVAL_DIR = ROOT / "docs/execution/spike-output/d3-tang32-eval-2026-06-11"
AUDIO_SRC = ROOT / "fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3"
DOCX_SRC = Path.home() / "Documents/转录/D3-堂3-2制控概讲（含禪堂开示）-5月2日（法砆法师).docx"
GOLD_TXT = ROOT / "fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt"
CHARS_PER_SEC = 250.0 / 60.0
PROJECT_NAME = "对照"


def now_ms() -> int:
    return int(time.time() * 1000)


def file_provenance(path: Path) -> tuple[str, str, int, int]:
    st = path.stat()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return str(path.resolve()), digest, st.st_size, int(st.st_mtime * 1000)


def canonicalize(path: Path) -> str:
    return str(path.resolve())


def extract_gold_paragraphs(docx: Path) -> list[str]:
    r = subprocess.run(
        ["textutil", "-convert", "txt", "-stdout", str(docx)],
        capture_output=True,
        text=True,
        check=False,
    )
    if r.returncode != 0 or not r.stdout.strip():
        raise RuntimeError(f"docx extract failed: {docx}")
    lines = [ln.strip() for ln in r.stdout.splitlines() if ln.strip()]
    if len(lines) >= 2:
        return lines
    # fallback: split long block on Chinese sentence end
    block = re.sub(r"\s+", "", r.stdout)
    parts = [p for p in re.split(r"(?<=[。！？])", block) if p.strip()]
    return parts or [block]


def estimate_segments(paragraphs: list[str]) -> list[dict]:
    segs: list[dict] = []
    t = 0.0
    for i, text in enumerate(paragraphs):
        text = text.strip()
        if not text:
            continue
        dur = max(1.0, len(text) / CHARS_PER_SEC)
        segs.append(
            {
                "idx": len(segs),
                "start_sec": t,
                "end_sec": t + dur,
                "text": text,
                "text_stage": "manual",
                "annotation": "gold",
            }
        )
        t += dur
    return segs


def load_sherpa_segments(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[dict] = []
    for s in data.get("segments") or []:
        text = str(s.get("text") or "").strip()
        if not text:
            continue
        out.append(
            {
                "idx": len(out),
                "start_sec": float(s.get("start_sec") or 0),
                "end_sec": float(s.get("end_sec") or 0),
                "text": text,
                "text_stage": "auto_transcribe",
                "annotation": "sherpa-qwen3-vad",
            }
        )
    return out


def load_paraformer_segments(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items") or []
    if not items:
        raise RuntimeError("paraformer eval report empty")
    item = items[0]
    hyp = str(item.get("hypothesis_concat") or "").strip()
    parts = [p.strip() for p in re.split(r"(?<=[。！？])", hyp) if p.strip()]
    return estimate_segments(parts)


def insert_segments(cur: sqlite3.Cursor, file_id: str, segments: list[dict]) -> None:
    for s in segments:
        cur.execute(
            """
            INSERT INTO segments (
              file_id, uid, idx, start_sec, end_sec, text,
              confidence, low_confidence, detail, kind, text_stage, finalize_via, annotation
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, '', NULL, ?, NULL, ?)
            """,
            (
                file_id,
                str(uuid.uuid4()),
                int(s["idx"]),
                float(s["start_sec"]),
                float(s["end_sec"]),
                s["text"],
                s.get("text_stage", "auto_transcribe"),
                s.get("annotation", ""),
            ),
        )


def main() -> int:
    sherpa_json = EVAL_DIR / "sherpa-qwen3-vad-1200s.json"
    para_json = EVAL_DIR / "paraformer-eval-report.json"
    for p in (DB_PATH, AUDIO_SRC, sherpa_json, para_json):
        if not p.is_file():
            print(f"missing: {p}", file=sys.stderr)
            return 2
    if not DOCX_SRC.is_file() and not GOLD_TXT.is_file():
        print("missing docx and gold txt", file=sys.stderr)
        return 2

    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout = 5000")
    cur = conn.cursor()
    existing = cur.execute(
        "SELECT id FROM projects WHERE name = ?", (PROJECT_NAME,)
    ).fetchone()
    if existing:
        pid = existing[0]
        print(f"project「{PROJECT_NAME}」already exists: {pid}")
        conn.close()
        return 0

    project_id = str(uuid.uuid4())
    sherpa_file_id = str(uuid.uuid4())
    gold_file_id = str(uuid.uuid4())
    para_file_id = str(uuid.uuid4())
    t = now_ms()

    project_dir = APP_ROOT / "projects" / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    dest_audio = project_dir / f"{sherpa_file_id}.mp3"
    shutil.copy2(AUDIO_SRC, dest_audio)
    audio_path = canonicalize(dest_audio)
    src_path, sha, size, mtime = file_provenance(AUDIO_SRC)

    sherpa_segs = load_sherpa_segments(sherpa_json)
    gold_paras = (
        extract_gold_paragraphs(DOCX_SRC)
        if DOCX_SRC.is_file()
        else [GOLD_TXT.read_text(encoding="utf-8")]
    )
    gold_segs = estimate_segments(gold_paras)
    para_segs = load_paraformer_segments(para_json)

    try:
        cur.execute("BEGIN")
        cur.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?)",
            (project_id, PROJECT_NAME, t, t),
        )
        # paired: Sherpa + audio
        cur.execute(
            """
            INSERT INTO files (
              id, project_id, name, file_type, audio_path,
              import_source_path, import_content_sha256, import_source_size, import_source_modified_ms,
              created_at_ms, updated_at_ms
            ) VALUES (?, ?, ?, 'paired', ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sherpa_file_id,
                project_id,
                "D3-堂3-2 · Sherpa Qwen3",
                audio_path,
                src_path,
                sha,
                size,
                mtime,
                t,
                t,
            ),
        )
        insert_segments(cur, sherpa_file_id, sherpa_segs)
        # text: gold
        cur.execute(
            """
            INSERT INTO files (
              id, project_id, name, file_type, audio_path,
              import_source_path, import_content_sha256, import_source_size, import_source_modified_ms,
              created_at_ms, updated_at_ms
            ) VALUES (?, ?, ?, 'text', NULL, ?, ?, ?, ?, ?, ?)
            """,
            (
                gold_file_id,
                project_id,
                "D3-堂3-2 · 金标 docx",
                str(DOCX_SRC.resolve()) if DOCX_SRC.is_file() else str(GOLD_TXT.resolve()),
                hashlib.sha256("\n".join(gold_paras).encode()).hexdigest(),
                len("\n".join(gold_paras)),
                mtime,
                t,
                t,
            ),
        )
        insert_segments(cur, gold_file_id, gold_segs)
        # text: Paraformer (sentence-split from eval)
        cur.execute(
            """
            INSERT INTO files (
              id, project_id, name, file_type, audio_path,
              created_at_ms, updated_at_ms
            ) VALUES (?, ?, ?, 'text', NULL, ?, ?)
            """,
            (
                para_file_id,
                project_id,
                "D3-堂3-2 · Paraformer",
                t,
                t,
            ),
        )
        insert_segments(cur, para_file_id, para_segs)
        cur.execute(
            "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?, ?, ?, ?)",
            (
                project_id,
                t,
                "seed_duizhao_project",
                json.dumps(
                    {
                        "op": "seed_duizhao_project",
                        "sherpa_segments": len(sherpa_segs),
                        "gold_segments": len(gold_segs),
                        "paraformer_segments": len(para_segs),
                        "eval_dir": str(EVAL_DIR),
                    },
                    ensure_ascii=False,
                ),
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        shutil.rmtree(project_dir, ignore_errors=True)
        raise
    finally:
        conn.close()

    print(f"OK project「{PROJECT_NAME}」")
    print(f"  id: {project_id}")
    print(f"  dir: {project_dir}")
    print(f"  files: Sherpa({len(sherpa_segs)} segs) · 金标({len(gold_segs)} segs) · Paraformer({len(para_segs)} segs)")
    print("  在 Rushi 项目列表中刷新或重开应用即可查看。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

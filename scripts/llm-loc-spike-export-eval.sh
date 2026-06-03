#!/usr/bin/env bash
# 从 App Data SQLite 导出 LLM-LOC-SPIKE eval 子集（≥20 段）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DB="${RUSHI_APP_DB:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/rushi.sqlite3}"
OUT="${ROOT}/fixtures/llm-loc-eval/eval_manifest.v1.json"
LIMIT="${RUSHI_LLM_LOC_EVAL_LIMIT:-30}"

[[ -f "${APP_DB}" ]] || { echo "No DB: ${APP_DB}" >&2; exit 1; }

python3 - "${APP_DB}" "${OUT}" "${LIMIT}" <<'PY'
import json, sqlite3, sys
from datetime import datetime, timezone

db, out, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
con = sqlite3.connect(db)
rows = con.execute(
    """
    SELECT s.uid, s.idx, s.text, f.name, p.name
    FROM segments s
    JOIN files f ON f.id = s.file_id
    JOIN projects p ON p.id = f.project_id
    WHERE length(trim(s.text)) >= 8
    ORDER BY s.id ASC
    LIMIT ?
    """,
    (limit,),
).fetchall()
terms = [r[0] for r in con.execute("SELECT term FROM glossary_terms WHERE hotword_enabled = 1 LIMIT 20").fetchall()]
con.close()

items = []
for uid, idx, text, fname, pname in rows:
    items.append({
        "id": f"seg-{uid[:8]}-{idx}",
        "segment_uid": uid,
        "segment_idx": idx,
        "segment_text": (text or "").strip(),
        "file_name": fname,
        "project_name": pname,
    })

doc = {
    "schema_version": "1",
    "description": "LLM-LOC-SPIKE eval subset (exported from app DB)",
    "exported_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "source_db": db,
    "glossary_sample": terms[:10],
    "items": items,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
print(f"Wrote {len(items)} items to {out}")
PY

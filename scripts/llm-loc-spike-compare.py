#!/usr/bin/env python3
"""Compare cloud baseline vs Ollama spike outputs (R3t-C)."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs/execution/spike-output"

_STRIP_PUNCT = re.compile(
    r"[\s，。！？、；：\"\"''（）【】《》…—·,.!?;:'()\[\]<>-]+"
)


def norm_chars(s: str) -> str:
    return _STRIP_PUNCT.sub("", s or "")


def word_rewrite(input_text: str, output_text: str) -> bool:
    """True if non-punctuation body changed materially."""
    a, b = norm_chars(input_text), norm_chars(output_text)
    if not a:
        return False
    return a != b


def similarity(a: str, b: str) -> float:
    x, y = norm_chars(a), norm_chars(b)
    if not x and not y:
        return 1.0
    if not x or not y:
        return 0.0
    # char bigram Jaccard on normalized text
    def grams(t: str) -> set[str]:
        if len(t) < 2:
            return {t} if t else set()
        return {t[i : i + 2] for i in range(len(t) - 1)}

    ga, gb = grams(x), grams(y)
    if not ga and not gb:
        return 1.0
    inter = len(ga & gb)
    union = len(ga | gb) or 1
    return inter / union


def load_items(path: Path) -> dict[str, dict]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for it in doc.get("items") or []:
        sid = it.get("id") or it.get("segment_uid")
        if sid:
            out[str(sid)] = it
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cloud", type=Path, required=True)
    ap.add_argument("--ollama", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    cloud = load_items(args.cloud)
    local = load_items(args.ollama)
    ids = sorted(set(cloud) & set(local))
    if not ids:
        print("No overlapping segment ids", file=sys.stderr)
        return 1

    rows = []
    agree_sim = 0
    cloud_rewrite = 0
    local_rewrite = 0
    for sid in ids:
        cin = cloud[sid].get("input", "")
        cout = cloud[sid].get("output", "")
        lout = local[sid].get("output", "")
        if cloud[sid].get("error") or local[sid].get("error"):
            rows.append({"id": sid, "skip": True})
            continue
        sim = similarity(cout, lout)
        cr = word_rewrite(cin, cout)
        lr = word_rewrite(cin, lout)
        if cr:
            cloud_rewrite += 1
        if lr:
            local_rewrite += 1
        if sim >= 0.85:
            agree_sim += 1
        rows.append(
            {
                "id": sid,
                "cloud_rewrite": cr,
                "local_rewrite": lr,
                "cloud_local_sim": round(sim, 3),
                "input": cin[:80],
                "cloud_out": (cout or "")[:80],
                "local_out": (lout or "")[:80],
            }
        )

    n = len([r for r in rows if not r.get("skip")])
    report = {
        "cloud_file": str(args.cloud),
        "ollama_file": str(args.ollama),
        "paired": n,
        "cloud_output_rewrite_count": cloud_rewrite,
        "local_output_rewrite_count": local_rewrite,
        "cloud_local_sim_ge_0_85": agree_sim,
        "cloud_local_sim_ge_0_85_rate": round(agree_sim / n, 3) if n else 0,
        "rows": rows,
    }
    out = args.out or (OUT_DIR / "llm-loc-compare-2026-06-03.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"paired={n} sim≥0.85={agree_sim} ({report['cloud_local_sim_ge_0_85_rate']:.1%}) "
        f"cloud_rewrite={cloud_rewrite} local_rewrite={local_rewrite} → {out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

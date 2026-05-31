#!/usr/bin/env python3
"""
P4: 按 eval_manifest 逐条 POST 本机 ASR，输出 JSON 报告（含 engine、warnings、可选 CER）。

依赖：本机已启动 rushi-asr；系统 PATH 中有 curl、python3。
评测指标：将仓库 services/asr 加入 PYTHONPATH 以导入 rushi_asr.eval_metrics（无需 pip install 根目录）。

用法（仓库根）:
  python3 scripts/eval-run.py
  python3 scripts/eval-run.py --manifest fixtures/eval/eval_manifest.v1.json --asr-base http://127.0.0.1:8741
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


def _load_eval_metrics():
    path = ROOT / "services" / "asr" / "rushi_asr" / "eval_metrics.py"
    spec = importlib.util.spec_from_file_location("rushi_eval_metrics", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.cer_chars, mod.low_confidence_ratio, mod.term_hit_rate


cer_chars, low_confidence_ratio, term_hit_rate = _load_eval_metrics()


def curl_transcribe(wav: Path, asr_base: str, hotwords: str | None = None) -> dict[str, Any]:
    url = asr_base.rstrip("/") + "/v1/transcribe"
    wav_abs = wav.resolve()
    if not wav_abs.is_file():
        raise FileNotFoundError(str(wav_abs))
    cmd = ["curl", "-sS", "-X", "POST", "-F", f"file=@{wav_abs}"]
    if hotwords and hotwords.strip():
        cmd.extend(["-F", f"hotwords={hotwords.strip()}"])
    cmd.append(url)
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=900,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or f"curl exit {r.returncode}")
    out = r.stdout.strip()
    if not out:
        raise RuntimeError("empty response from ASR (check URL and server logs)")
    return json.loads(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="P4 manifest batch transcribe + metrics")
    ap.add_argument(
        "--manifest",
        type=Path,
        default=ROOT / "fixtures" / "eval" / "eval_manifest.v1.json",
        help="eval_manifest.v1.json path",
    )
    ap.add_argument(
        "--asr-base",
        default="http://127.0.0.1:8741",
        help="ASR base URL (no trailing slash required)",
    )
    args = ap.parse_args()
    manifest_path: Path = args.manifest
    if not manifest_path.is_file():
        print(f"Manifest not found: {manifest_path}", file=sys.stderr)
        return 2
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    items = data.get("items")
    if not isinstance(items, list):
        print("Invalid manifest: missing items[]", file=sys.stderr)
        return 2

    base_dir = manifest_path.parent
    out_rows: list[dict[str, Any]] = []
    failed = False
    for it in items:
        if not isinstance(it, dict):
            continue
        iid = it.get("id", "?")
        rel = it.get("audio_relpath")
        ref = (it.get("reference_transcript") or "").strip()
        expected_terms = it.get("expected_terms")
        if not isinstance(expected_terms, list):
            expected_terms = []
        optional = bool(it.get("optional"))
        hotwords = (it.get("hotwords") or "").strip() or None
        cat = it.get("category", "")
        row: dict[str, Any] = {"id": iid, "category": cat, "audio_relpath": rel}
        if not isinstance(rel, str) or not rel:
            row["error"] = "missing audio_relpath"
            failed = True
            out_rows.append(row)
            continue
        wav = (base_dir / rel).resolve()
        if not wav.is_file():
            if optional:
                row["skipped"] = "optional_audio_missing"
                out_rows.append(row)
                continue
            row["error"] = f"audio not found: {wav}"
            failed = True
            out_rows.append(row)
            continue
        try:
            body = curl_transcribe(wav, args.asr_base, hotwords)
        except Exception as e:  # noqa: BLE001
            row["error"] = str(e)
            failed = True
            out_rows.append(row)
            continue
        row["engine"] = body.get("engine")
        row["warnings"] = body.get("warnings") or []
        segs = body.get("segments") or []
        if not isinstance(segs, list):
            segs = []
        hyp = "".join(str(s.get("text") or "") for s in segs if isinstance(s, dict))
        row["hypothesis_concat"] = hyp
        row["low_confidence_ratio"] = low_confidence_ratio(
            segs if all(isinstance(s, dict) for s in segs) else []
        )
        if ref:
            row["cer_chars"] = cer_chars(ref, hyp)
        else:
            row["cer_chars"] = None
        if expected_terms:
            terms = [str(t).strip() for t in expected_terms if str(t).strip()]
            row["expected_terms"] = terms
            row["term_hit_rate"] = term_hit_rate(terms, hyp)
        out_rows.append(row)

    report = {
        "schema_version": "1",
        "manifest": str(manifest_path),
        "asr_base": args.asr_base.rstrip("/"),
        "items": out_rows,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

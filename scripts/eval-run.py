#!/usr/bin/env python3
"""
P4 / ASR-VOC-5 / ACC-EVAL-2: 按 eval_manifest 逐条 POST 本机 ASR，输出 JSON 或 CSV 报告。

依赖：本机已启动 rushi-asr；系统 PATH 中有 curl、python3。
评测指标：将仓库 services/asr 加入 PYTHONPATH 以导入 rushi_asr（无需 pip install 根目录）。

用法（仓库根）:
  python3 scripts/eval-run.py
  python3 scripts/eval-run.py --manifest fixtures/eval/eval_manifest.v1.json --asr-base http://127.0.0.1:8741
  python3 scripts/eval-run.py --hotwords-ab --filter-id proper-noun-zhikong --format csv
  python3 scripts/eval-run.py --hotwords-mode off --filter-id proper-noun-zhikong
  python3 scripts/eval-run.py --filter-id proper-noun-zhikong --assert-min-segments
  python3 scripts/eval-run.py --output ~/.rushi-quality/last_eval_report.json
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import subprocess
import sys
import time
from io import StringIO
from pathlib import Path
from typing import Any, Literal

ROOT = Path(__file__).resolve().parent.parent
ASR_PKG = ROOT / "services" / "asr" / "rushi_asr"


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_eval_metrics = _load_module("rushi_eval_metrics", ASR_PKG / "eval_metrics.py")
_eval_manifest = _load_module("rushi_eval_manifest", ASR_PKG / "eval_manifest.py")

cer_chars = _eval_metrics.cer_chars
low_confidence_ratio = _eval_metrics.low_confidence_ratio
resolve_segmentation_mode = _eval_metrics.resolve_segmentation_mode
rtfx = _eval_metrics.rtfx
term_hit_rate = _eval_metrics.term_hit_rate
resolve_hotwords = _eval_manifest.resolve_hotwords
expand_manifest_runs = _eval_manifest.expand_manifest_runs

HotwordsMode = Literal["manifest", "on", "off"]


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


def transcribe_manifest_item(
    it: dict[str, Any],
    *,
    base_dir: Path,
    asr_base: str,
    hotwords_mode: HotwordsMode,
    ab_variant: str | None,
) -> dict[str, Any]:
    iid = it.get("id", "?")
    rel = it.get("audio_relpath")
    ref = (it.get("reference_transcript") or "").strip()
    expected_terms = it.get("expected_terms")
    if not isinstance(expected_terms, list):
        expected_terms = []
    optional = bool(it.get("optional"))
    cat = it.get("category", "")

    hotwords_text, hotwords_enabled = resolve_hotwords(
        it,
        hotwords_mode,
        ab_variant=ab_variant,  # type: ignore[arg-type]
    )

    row: dict[str, Any] = {
        "id": iid,
        "category": cat,
        "audio_relpath": rel,
        "hotwords_mode": hotwords_mode,
        "hotwords_ab_variant": ab_variant,
        "hotwords_enabled": hotwords_enabled,
        "hotwords_sent": hotwords_text,
    }

    if not isinstance(rel, str) or not rel:
        row["error"] = "missing audio_relpath"
        return row

    wav = (base_dir / rel).resolve()
    if not wav.is_file():
        if optional:
            row["skipped"] = "optional_audio_missing"
            return row
        row["error"] = f"audio not found: {wav}"
        return row

    try:
        t0 = time.perf_counter()
        body = curl_transcribe(wav, asr_base, hotwords_text)
        row["wall_sec"] = round(time.perf_counter() - t0, 3)
    except Exception as e:  # noqa: BLE001
        row["error"] = str(e)
        return row

    row["engine"] = body.get("engine")
    warnings = body.get("warnings") or []
    if not isinstance(warnings, list):
        warnings = []
    row["warnings"] = warnings
    segs = body.get("segments") or []
    if not isinstance(segs, list):
        segs = []
    row["segment_count"] = len([s for s in segs if isinstance(s, dict)])
    duration_raw = body.get("duration_sec")
    try:
        row["duration_sec"] = float(duration_raw) if duration_raw is not None else None
    except (TypeError, ValueError):
        row["duration_sec"] = None
    row["rtfx"] = rtfx(row.get("duration_sec"), row.get("wall_sec"))
    row["segmentation_mode"] = resolve_segmentation_mode(body, warnings)
    hyp = "".join(str(s.get("text") or "") for s in segs if isinstance(s, dict))
    row["hypothesis_concat"] = hyp
    row["low_confidence_ratio"] = low_confidence_ratio(
        segs if all(isinstance(s, dict) for s in segs) else []
    )
    row["cer_chars"] = cer_chars(ref, hyp) if ref else None
    if expected_terms:
        terms = [str(t).strip() for t in expected_terms if str(t).strip()]
        row["expected_terms"] = terms
        row["term_hit_rate"] = term_hit_rate(terms, hyp)
    return row


def check_min_segments_assertion(
    item: dict[str, Any],
    row: dict[str, Any],
    *,
    assert_min_segments: bool,
) -> bool:
    """Return True when assertion fails (caller should mark run failed)."""
    if not assert_min_segments:
        return False
    min_seg = item.get("min_segments")
    if min_seg is None:
        return False
    try:
        required = int(min_seg)
    except (TypeError, ValueError):
        return False
    if required <= 0:
        return False
    count = row.get("segment_count")
    if count is None or row.get("error") or row.get("skipped"):
        row["min_segments_assertion_failed"] = True
        row["min_segments_required"] = required
        return True
    if int(count) < required:
        row["min_segments_assertion_failed"] = True
        row["min_segments_required"] = required
        return True
    return False


CSV_COLUMNS = [
    "id",
    "category",
    "hotwords_ab_variant",
    "hotwords_enabled",
    "hotwords_sent",
    "segment_count",
    "duration_sec",
    "wall_sec",
    "rtfx",
    "segmentation_mode",
    "term_hit_rate",
    "cer_chars",
    "low_confidence_ratio",
    "engine",
    "warnings",
    "min_segments_assertion_failed",
    "error",
    "skipped",
]


def print_csv(rows: list[dict[str, Any]]) -> None:
    buf = StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        out = dict(row)
        if "warnings" in out and not isinstance(out["warnings"], str):
            out["warnings"] = json.dumps(out["warnings"], ensure_ascii=False)
        writer.writerow(out)
    sys.stdout.write(buf.getvalue())


def main() -> int:
    ap = argparse.ArgumentParser(
        description="P4 manifest batch transcribe + metrics (ASR-VOC-5 / ACC-EVAL-2)",
    )
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
    ap.add_argument(
        "--hotwords-mode",
        choices=["manifest", "on", "off"],
        default="manifest",
        help="manifest=per-item hotwords field; on/off=force for all runs",
    )
    ap.add_argument(
        "--hotwords-ab",
        action="store_true",
        help="For items with hotwords_ab in manifest, run on then off (two transcribes)",
    )
    ap.add_argument(
        "--filter-id",
        default=None,
        help="Only run manifest item with this id",
    )
    ap.add_argument(
        "--format",
        choices=["json", "csv"],
        default="json",
        help="Output format (csv suited for hotwords A/B spreadsheet)",
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write JSON report to this path (R4 quality Tab)",
    )
    ap.add_argument(
        "--assert-min-segments",
        action="store_true",
        help="Exit 1 when item min_segments is set and segment_count is below it",
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
    hotwords_mode: HotwordsMode = args.hotwords_mode
    runs = expand_manifest_runs(
        items,
        hotwords_ab=bool(args.hotwords_ab),
        hotwords_mode=hotwords_mode,
        filter_id=args.filter_id,
    )

    out_rows: list[dict[str, Any]] = []
    failed = False
    for it, ab_variant in runs:
        row = transcribe_manifest_item(
            it,
            base_dir=base_dir,
            asr_base=args.asr_base,
            hotwords_mode=hotwords_mode,
            ab_variant=ab_variant,
        )
        if row.get("error"):
            failed = True
        if check_min_segments_assertion(
            it,
            row,
            assert_min_segments=bool(args.assert_min_segments),
        ):
            failed = True
        out_rows.append(row)

    if args.format == "csv":
        print_csv(out_rows)
        return 1 if failed else 0

    report = {
        "schema_version": "1",
        "metrics_schema": "acc-eval-2",
        "manifest": str(manifest_path),
        "asr_base": args.asr_base.rstrip("/"),
        "hotwords_mode": hotwords_mode,
        "hotwords_ab": bool(args.hotwords_ab),
        "assert_min_segments": bool(args.assert_min_segments),
        "filter_id": args.filter_id,
        "finished_at_ms": int(time.time() * 1000),
        "exit_code": 1 if failed else 0,
        "items": out_rows,
    }
    payload = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    print(payload)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

"""CLI report shape for scripts/eval-run.py (ASR-VOC-5)."""

from __future__ import annotations

import importlib.util
import json
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _load_eval_run_module():
    path = ROOT / "scripts" / "eval-run.py"
    spec = importlib.util.spec_from_file_location("eval_run_cli", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_zhikong_manifest_includes_hotwords_ab() -> None:
    manifest = json.loads((ROOT / "fixtures" / "eval" / "eval_manifest.v1.json").read_text(encoding="utf-8"))
    item = next(i for i in manifest["items"] if i.get("id") == "proper-noun-zhikong")
    assert item.get("hotwords") == "制控"
    assert item.get("hotwords_ab", {}).get("on") == "制控"
    assert item.get("category") == "long_form"
    assert item.get("min_segments") == 10


def test_print_csv_includes_ab_columns() -> None:
    mod = _load_eval_run_module()
    buf = StringIO()
    import sys

    old = sys.stdout
    try:
        sys.stdout = buf
        mod.print_csv(
            [
                {
                    "id": "proper-noun-zhikong",
                    "category": "long_form",
                    "hotwords_ab_variant": "on",
                    "hotwords_enabled": True,
                    "hotwords_sent": "制控",
                    "segment_count": 197,
                    "duration_sec": 1249.7,
                    "wall_sec": 155.5,
                    "rtfx": 8.04,
                    "segmentation_mode": "sentence_info",
                    "term_hit_rate": 0.0,
                    "engine": "test-engine",
                    "warnings": [],
                },
                {
                    "id": "proper-noun-zhikong",
                    "category": "long_form",
                    "hotwords_ab_variant": "off",
                    "hotwords_enabled": False,
                    "hotwords_sent": None,
                    "segment_count": 0,
                    "duration_sec": None,
                    "wall_sec": None,
                    "rtfx": None,
                    "segmentation_mode": None,
                    "term_hit_rate": 0.0,
                    "engine": "test-engine",
                    "warnings": ["hotwords_ignored_stub"],
                },
            ]
        )
    finally:
        sys.stdout = old
    text = buf.getvalue()
    header = text.splitlines()[0]
    assert "hotwords_ab_variant" in header
    assert "segment_count" in header
    assert "rtfx" in header
    assert "segmentation_mode" in header
    assert ",on," in text or ',"on",' in text
    assert "term_hit_rate" in text


def test_check_min_segments_assertion_pass() -> None:
    mod = _load_eval_run_module()
    item = {"min_segments": 10}
    row = {"segment_count": 197}
    assert mod.check_min_segments_assertion(item, row, assert_min_segments=True) is False
    assert "min_segments_assertion_failed" not in row


def test_check_min_segments_assertion_fail() -> None:
    mod = _load_eval_run_module()
    item = {"min_segments": 10}
    row = {"segment_count": 0}
    assert mod.check_min_segments_assertion(item, row, assert_min_segments=True) is True
    assert row["min_segments_assertion_failed"] is True
    assert row["min_segments_required"] == 10


def test_warmup_skippable_reason_for_stub_health() -> None:
    mod = _load_eval_run_module()
    assert mod.warmup_skippable_reason({"transcription_mode": "stub"}) == "stub_mode"
    assert mod.warmup_skippable_reason({"funasr_import_ok": False}) == "funasr_not_available"
    assert mod.warmup_skippable_reason({"funasr_import_ok": True, "ready_for_transcribe": False}) == "funasr_not_ready"
    assert mod.warmup_skippable_reason({"funasr_import_ok": True, "ready_for_transcribe": True}) is None

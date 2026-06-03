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
                    "hotwords_ab_variant": "on",
                    "hotwords_enabled": True,
                    "hotwords_sent": "制控",
                    "term_hit_rate": 0.0,
                    "engine": "test-engine",
                    "warnings": [],
                },
                {
                    "id": "proper-noun-zhikong",
                    "hotwords_ab_variant": "off",
                    "hotwords_enabled": False,
                    "hotwords_sent": None,
                    "term_hit_rate": 0.0,
                    "engine": "test-engine",
                    "warnings": ["hotwords_ignored_stub"],
                },
            ]
        )
    finally:
        sys.stdout = old
    text = buf.getvalue()
    assert "hotwords_ab_variant" in text.splitlines()[0]
    assert ",on," in text or ',"on",' in text
    assert "term_hit_rate" in text

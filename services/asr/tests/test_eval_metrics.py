from __future__ import annotations

import pytest

from rushi_asr.eval_metrics import (
    cer_chars,
    levenshtein_chars,
    low_confidence_ratio,
    resolve_segmentation_mode,
    rtfx,
    term_hit_rate,
)


def test_levenshtein_ascii() -> None:
    assert levenshtein_chars("kitten", "sitting") == 3


def test_cer_perfect() -> None:
    assert cer_chars("禅修", "禅修") == 0.0


def test_cer_substitution() -> None:
    # one char wrong of two -> 0.5
    assert cer_chars("禅修", "蝉修") == 0.5


def test_cer_ignores_whitespace() -> None:
    assert cer_chars("制 控\n", "制控") == 0.0


def test_term_hit_rate() -> None:
    assert term_hit_rate(["禅修", "打坐"], "今天禅修与打坐") == 1.0
    assert term_hit_rate(["禅修", "缺失"], "只有禅修") == 0.5


def test_low_confidence_ratio() -> None:
    segs = [{"low_confidence": True}, {"low_confidence": False}]
    assert low_confidence_ratio(segs) == 0.5


def test_rtfx_basic() -> None:
    assert rtfx(1250.0, 155.5) == pytest.approx(8.039, rel=0.01)


def test_rtfx_invalid() -> None:
    assert rtfx(None, 10.0) is None
    assert rtfx(100.0, 0.0) is None
    assert rtfx(100.0, None) is None


def test_resolve_segmentation_mode_from_body() -> None:
    assert resolve_segmentation_mode({"segmentation_mode": "sentence_info"}, []) == "sentence_info"


def test_resolve_segmentation_mode_from_warnings() -> None:
    body: dict[str, object] = {}
    warnings = ["segmentation_mode:vad_timestamp", "other"]
    assert resolve_segmentation_mode(body, warnings) == "vad_timestamp"

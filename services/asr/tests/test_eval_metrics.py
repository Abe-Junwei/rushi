from __future__ import annotations

from rushi_asr.eval_metrics import cer_chars, levenshtein_chars, low_confidence_ratio, term_hit_rate


def test_levenshtein_ascii() -> None:
    assert levenshtein_chars("kitten", "sitting") == 3


def test_cer_perfect() -> None:
    assert cer_chars("禅修", "禅修") == 0.0


def test_cer_substitution() -> None:
    # one char wrong of two -> 0.5
    assert cer_chars("禅修", "蝉修") == 0.5


def test_term_hit_rate() -> None:
    assert term_hit_rate(["禅修", "打坐"], "今天禅修与打坐") == 1.0
    assert term_hit_rate(["禅修", "缺失"], "只有禅修") == 0.5


def test_low_confidence_ratio() -> None:
    segs = [{"low_confidence": True}, {"low_confidence": False}]
    assert low_confidence_ratio(segs) == 0.5

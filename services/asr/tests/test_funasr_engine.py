from __future__ import annotations

from pathlib import Path

import pytest

import rushi_asr.funasr_engine as funasr_engine
from rushi_asr.funasr_engine import _segments_from_sentence_info


def test_sentence_info_keeps_seconds_for_long_audio() -> None:
    segs = _segments_from_sentence_info(
        [{"start": 300.0, "end": 330.0, "text": "long clip"}],
        duration_sec=540.0,
    )
    assert len(segs) == 1
    assert segs[0].start_sec == 300.0
    assert segs[0].end_sec == 330.0


def test_sentence_info_converts_milliseconds_when_far_above_duration() -> None:
    segs = _segments_from_sentence_info(
        [{"start": 300000.0, "end": 330000.0, "text": "long clip"}],
        duration_sec=540.0,
    )
    assert len(segs) == 1
    assert segs[0].start_sec == 300.0
    assert segs[0].end_sec == 330.0


def test_transcribe_with_funasr_blocks_hidden_model_downloads(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(funasr_engine, "effective_funasr_model_id", lambda: "iic/SenseVoiceSmall")
    monkeypatch.setattr(funasr_engine, "required_models_cached_guess", lambda _model_id=None: False)

    def fail_get_model(_model_id: str) -> None:
        raise AssertionError("should not load or download model when cache is incomplete")

    monkeypatch.setattr(funasr_engine, "_get_model", fail_get_model)

    with pytest.raises(RuntimeError, match="funasr_models_not_ready"):
        funasr_engine.transcribe_with_funasr(tmp_path / "normalized.wav", 1.0)

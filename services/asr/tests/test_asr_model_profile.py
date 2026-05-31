from __future__ import annotations

import os

import pytest

from rushi_asr.asr_model_profile import (
    LONG_AUDIO_SEC,
    build_generate_kwargs,
    resolve_asr_model_profile,
    sensevoice_use_itn_default,
)
from rushi_asr.segmentation import funasr_generate_kwargs

PARA = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
SENSE = "iic/SenseVoiceSmall"


def test_resolve_profiles() -> None:
    assert resolve_asr_model_profile(SENSE).profile_id == "sensevoice_small_v1"
    assert resolve_asr_model_profile(PARA).profile_id == "paraformer_vad_punc_v1"


def test_paraformer_snapshot() -> None:
    kwargs = build_generate_kwargs(PARA, "zh", "制控", duration_sec=900.0)
    assert kwargs == {
        "language": "zh",
        "sentence_timestamp": True,
        "merge_vad": False,
        "batch_size_s": 60,
        "batch_size_threshold_s": 30,
        "hotword": "制控",
    }


def test_paraformer_short_audio_no_batch() -> None:
    kwargs = build_generate_kwargs(PARA, "zh", None, duration_sec=60.0)
    assert "batch_size_s" not in kwargs
    assert kwargs["merge_vad"] is False


def test_sensevoice_long_audio_snapshot() -> None:
    kwargs = build_generate_kwargs(SENSE, "zh", None, duration_sec=LONG_AUDIO_SEC)
    assert kwargs["language"] == "zh"
    assert kwargs["merge_vad"] is False
    assert kwargs["batch_size_s"] == 60
    assert kwargs["batch_size_threshold_s"] == 30
    assert kwargs["use_itn"] is True
    assert kwargs["rich_transcription_postprocess"] is True


def test_sensevoice_short_audio_snapshot() -> None:
    kwargs = build_generate_kwargs(SENSE, "zh", None, duration_sec=20.0)
    assert kwargs["merge_vad"] is True
    assert "batch_size_s" not in kwargs
    assert kwargs["use_itn"] is True


def test_segmentation_delegate_matches_profile() -> None:
    a = funasr_generate_kwargs(SENSE, "zh", "foo", duration_sec=20.0)
    b = build_generate_kwargs(SENSE, "zh", "foo", duration_sec=20.0)
    assert a == b


def test_use_itn_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_USE_ITN", "0")
    assert sensevoice_use_itn_default() is False
    kwargs = build_generate_kwargs(SENSE, "zh", None, duration_sec=20.0)
    assert "use_itn" not in kwargs
    assert "rich_transcription_postprocess" not in kwargs
    monkeypatch.delenv("RUSHI_FUNASR_USE_ITN", raising=False)


def test_use_itn_env_enable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_USE_ITN", "1")
    assert sensevoice_use_itn_default() is True
    monkeypatch.delenv("RUSHI_FUNASR_USE_ITN", raising=False)


def test_paraformer_no_itn_even_with_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RUSHI_FUNASR_USE_ITN", "1")
    kwargs = build_generate_kwargs(PARA, "zh", None, duration_sec=60.0)
    assert "use_itn" not in kwargs
    monkeypatch.delenv("RUSHI_FUNASR_USE_ITN", raising=False)

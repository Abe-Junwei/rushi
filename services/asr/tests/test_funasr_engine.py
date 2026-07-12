from __future__ import annotations

from pathlib import Path

import pytest

import rushi_asr.funasr_engine as funasr_engine
from rushi_asr.funasr_engine import invalidate_funasr_model_cache
from rushi_asr.asr_model_profile import LONG_AUDIO_SEC
from rushi_asr.segmentation import (
    SHORT_WHOLE_TRACK_MAX_SEC,
    funasr_generate_kwargs,
    segment_audio_to_transcription_segments,
    segment_funasr_generate_result,
    segments_from_sentence_info,
    segments_from_timestamp_field,
)


def test_sentence_info_keeps_seconds_for_long_audio() -> None:
    segs = segments_from_sentence_info(
        [{"start": 300.0, "end": 330.0, "text": "long clip"}],
        duration_sec=540.0,
    )
    assert len(segs) == 1
    assert segs[0].start_sec == 300.0
    assert segs[0].end_sec == 330.0


def test_sentence_info_converts_milliseconds_when_far_above_duration() -> None:
    segs = segments_from_sentence_info(
        [{"start": 300000.0, "end": 330000.0, "text": "long clip"}],
        duration_sec=540.0,
    )
    assert len(segs) == 1
    assert segs[0].start_sec == 300.0
    assert segs[0].end_sec == 330.0


def test_sentence_info_keeps_zero_start_second() -> None:
    segs = segments_from_sentence_info(
        [{"start": 0, "end": 12.5, "text": "开头一句"}],
        duration_sec=780.0,
    )
    assert len(segs) == 1
    assert segs[0].start_sec == 0.0
    assert segs[0].end_sec == 12.5


def test_sentence_info_millisecond_timestamps_below_per_row_threshold() -> None:
    """FunASR sentence_info often uses ms; per-row normalize used to mis-read as seconds."""
    rows = [
        {"start": 0, "end": 3400, "text": "第一句"},
        {"start": 3400, "end": 8200, "text": "第二句"},
        {"start": 8200, "end": 12500, "text": "第三句"},
    ]
    segs = segments_from_sentence_info(rows, duration_sec=780.0)
    assert len(segs) == 3
    assert segs[0].start_sec == 0.0
    assert segs[0].end_sec == pytest.approx(3.4)
    assert segs[1].start_sec == pytest.approx(3.4)
    assert segs[1].end_sec == pytest.approx(8.2)
    assert segs[2].start_sec == pytest.approx(8.2)
    assert segs[2].end_sec == pytest.approx(12.5)


def test_paraformer_generate_kwargs_request_sentence_timestamp() -> None:
    para = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
    kwargs = funasr_generate_kwargs(para, "zh", None, duration_sec=900.0)
    assert kwargs["sentence_timestamp"] is True
    assert kwargs["merge_vad"] is False


def test_sensevoice_long_audio_disables_merge_vad() -> None:
    kwargs = funasr_generate_kwargs("iic/SenseVoiceSmall", "zh", None, duration_sec=LONG_AUDIO_SEC)
    assert kwargs["merge_vad"] is False
    assert kwargs["batch_size_s"] == 60


def test_sensevoice_short_audio_merges_vad() -> None:
    kwargs = funasr_generate_kwargs("iic/SenseVoiceSmall", "zh", None, duration_sec=20.0)
    assert kwargs["merge_vad"] is True
    assert "batch_size_s" not in kwargs


def test_long_audio_text_only_does_not_whole_track_fallback() -> None:
    warnings: list[str] = []
    segs, mode = segment_funasr_generate_result(
        {"text": "整轨全文无时间戳"},
        duration_sec=600.0,
        model_id="iic/SenseVoiceSmall",
        out_warnings=warnings,
    )
    assert segs == []
    assert mode == "empty"
    assert any("funasr_long_audio_no_segments" in w for w in warnings)
    assert not any("funasr_whole_track_fallback" in w for w in warnings)


def test_short_audio_text_only_uses_whole_track_fallback() -> None:
    warnings: list[str] = []
    segs, mode = segment_funasr_generate_result(
        {"text": "短音频"},
        duration_sec=SHORT_WHOLE_TRACK_MAX_SEC - 1,
        model_id="iic/SenseVoiceSmall",
        out_warnings=warnings,
    )
    assert len(segs) == 1
    assert mode == "whole_track_fallback"
    assert segs[0].detail == "funasr_whole_track_fallback"


def test_timestamp_field_builds_vad_segments() -> None:
    text = "第一段内容第二段内容"
    timestamp = [
        [0, 5000],
        [5000, 10000],
        [12000, 18000],
        [18000, 24000],
    ]
    segs = segments_from_timestamp_field(text, timestamp, duration_sec=30.0)
    assert len(segs) >= 2
    assert segs[0].start_sec == 0.0
    assert segs[0].detail == "funasr_vad_timestamp"


def test_segment_audio_alias_matches_segment_funasr_result() -> None:
    payload = {"sentence_info": [{"start": 0, "end": 2.5, "text": "hi"}]}
    a, mode_a = segment_funasr_generate_result(payload, 10.0, "iic/SenseVoiceSmall")
    b, mode_b = segment_audio_to_transcription_segments(payload, 10.0, "iic/SenseVoiceSmall")
    assert a == b
    assert mode_a == mode_b == "sentence_info"


def test_unknown_duration_text_only_skips_whole_track_fallback() -> None:
    warnings: list[str] = []
    segs, mode = segment_funasr_generate_result(
        {"text": "无时长信息"},
        duration_sec=None,
        model_id="iic/SenseVoiceSmall",
        out_warnings=warnings,
    )
    assert segs == []
    assert mode == "empty"
    assert not any("funasr_whole_track_fallback" in w for w in warnings)


def test_loaded_funasr_model_id_tracks_singleton() -> None:
    assert funasr_engine.loaded_funasr_model_id() is None
    funasr_engine._model_loaded_id = "iic/SenseVoiceSmall"
    assert funasr_engine.loaded_funasr_model_id() == "iic/SenseVoiceSmall"
    invalidate_funasr_model_cache()
    assert funasr_engine.loaded_funasr_model_id() is None


def test_invalidate_funasr_model_cache_clears_singleton(monkeypatch) -> None:
    sentinel = object()
    funasr_engine._model_singleton = sentinel
    funasr_engine._model_loaded_id = "iic/SenseVoiceSmall"
    funasr_engine._model_loaded_device = "cpu"
    invalidate_funasr_model_cache()
    assert funasr_engine._model_singleton is None
    assert funasr_engine._model_loaded_id is None
    assert funasr_engine._model_loaded_device is None


def test_get_model_reloads_when_resolved_device_changes(monkeypatch) -> None:
    """Changing RUSHI_FUNASR_DEVICE must not reuse a singleton loaded on another device."""
    loads: list[str] = []

    class FakeAutoModel:
        def __init__(self, **kwargs: object) -> None:
            loads.append(str(kwargs.get("device")))

    monkeypatch.setattr(
        funasr_engine,
        "configure_hub_env",
        lambda: None,
    )
    monkeypatch.setattr(
        "rushi_asr.funasr_engine_load.resolve_funasr_automodel_arg",
        lambda model_id, **_kwargs: model_id,
    )
    monkeypatch.setattr(
        funasr_engine,
        "effective_funasr_vad_model_id",
        lambda: None,
    )
    monkeypatch.setattr(
        "rushi_asr.funasr_engine_load.effective_funasr_punc_model_id",
        lambda _model_id: None,
    )
    monkeypatch.setitem(
        __import__("sys").modules,
        "funasr",
        type("funasr", (), {"AutoModel": FakeAutoModel})(),
    )

    monkeypatch.setenv("RUSHI_FUNASR_DEVICE", "cpu")
    first = funasr_engine._get_model("iic/SenseVoiceSmall")
    assert loads == ["cpu"]
    assert funasr_engine._model_loaded_device == "cpu"
    assert first is funasr_engine._model_singleton

    monkeypatch.setenv("RUSHI_FUNASR_DEVICE", "mps")
    second = funasr_engine._get_model("iic/SenseVoiceSmall")
    assert loads == ["cpu", "mps"]
    assert funasr_engine._model_loaded_device == "mps"
    assert second is funasr_engine._model_singleton
    assert second is not first

    invalidate_funasr_model_cache()


def test_invalidate_funasr_model_cache_calls_mps_empty_cache(monkeypatch) -> None:
    import sys

    calls: list[str] = []

    class FakeMps:
        @staticmethod
        def is_available() -> bool:
            return True

        @staticmethod
        def empty_cache() -> None:
            calls.append("mps")

    class FakeCuda:
        @staticmethod
        def is_available() -> bool:
            return False

        @staticmethod
        def empty_cache() -> None:
            calls.append("cuda")

    class FakeBackends:
        mps = FakeMps()

    fake_torch = type(
        "torch",
        (),
        {"cuda": FakeCuda, "backends": FakeBackends, "mps": FakeMps},
    )()
    monkeypatch.setitem(sys.modules, "torch", fake_torch)

    invalidate_funasr_model_cache()
    assert calls == ["mps"]


def test_transcribe_with_funasr_blocks_hidden_model_downloads(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(funasr_engine, "effective_funasr_model_id", lambda: "iic/SenseVoiceSmall")
    monkeypatch.setattr(funasr_engine, "required_models_cached_guess", lambda _model_id=None: False)

    def fail_get_model(_model_id: str) -> None:
        raise AssertionError("should not load or download model when cache is incomplete")

    monkeypatch.setattr(funasr_engine, "_get_model", fail_get_model)

    with pytest.raises(RuntimeError, match="funasr_models_not_ready"):
        funasr_engine.transcribe_with_funasr(tmp_path / "normalized.wav", 1.0)


def test_warmup_funasr_model_delegates_to_get_model(monkeypatch) -> None:
    calls: list[str] = []
    model_id = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"

    def fake_get_model(model_id: str) -> str:
        calls.append(model_id)
        return "loaded"

    monkeypatch.setattr(funasr_engine, "effective_funasr_model_id", lambda: model_id)
    monkeypatch.setattr(funasr_engine, "required_models_cached_guess", lambda _model_id=None: True)
    monkeypatch.setattr(funasr_engine, "_get_model", fake_get_model)
    monkeypatch.setattr(funasr_engine, "loaded_funasr_model_id", lambda: model_id)
    monkeypatch.setattr(funasr_engine, "configure_hub_env", lambda: None)

    body = funasr_engine.warmup_funasr_model()
    assert calls == [model_id]
    assert body["status"] == "ok"
    assert body["funasr_loaded_model_id"] == model_id


def test_generate_filters_profile_unsupported_params_before_inference(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    calls: list[dict[str, object]] = []

    class FakeModel:
        def generate(self, **kwargs: object) -> list[dict[str, object]]:
            calls.append(dict(kwargs))
            return [{"text": "短音频全文"}]

    monkeypatch.setattr(funasr_engine, "effective_funasr_model_id", lambda: "custom/generic-model")
    monkeypatch.setattr(funasr_engine, "required_models_cached_guess", lambda _model_id=None: True)
    monkeypatch.setattr(funasr_engine, "_get_model", lambda _model_id: FakeModel())
    monkeypatch.setattr(
        funasr_engine,
        "funasr_generate_kwargs",
        lambda *_args, **_kwargs: {
            "language": "zh",
            "merge_vad": True,
            "sentence_timestamp": True,
        },
    )

    warnings: list[str] = []
    segs, _engine, mode = funasr_engine.generate_and_parse_funasr(
        tmp_path / "normalized.wav",
        10.0,
        out_warnings=warnings,
    )

    assert len(segs) == 1
    assert mode == "whole_track_fallback"
    assert calls == [{"input": str(tmp_path / "normalized.wav"), "language": "zh", "merge_vad": True}]
    assert "funasr_generate_param_filtered:sentence_timestamp" in warnings

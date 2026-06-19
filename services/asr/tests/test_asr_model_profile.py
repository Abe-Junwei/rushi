from __future__ import annotations

from rushi_asr.asr_model_profile import (
    LONG_AUDIO_SEC,
    build_generate_kwargs,
    filter_generate_kwargs_for_model,
    resolve_asr_model_profile,
    sensevoice_use_itn_default,
    supported_generate_param_keys,
)
from rushi_asr.segmentation import funasr_generate_kwargs

PARA = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
SENSE = "iic/SenseVoiceSmall"
NANO = "FunAudioLLM/Fun-ASR-Nano-2512"


def test_resolve_profiles() -> None:
    assert resolve_asr_model_profile(SENSE).profile_id == "sensevoice_small_v1"
    assert resolve_asr_model_profile(PARA).profile_id == "paraformer_vad_punc_v1"
    assert resolve_asr_model_profile("Qwen/Qwen3-ASR-0.6B").sku_family == "generic"
    assert resolve_asr_model_profile(NANO).profile_id == "funasr_nano_2512_v1"
    assert resolve_asr_model_profile(NANO).sku_family == "funasr_nano"


def test_qwen_id_uses_generic_generate_profile() -> None:
    kwargs = build_generate_kwargs("Qwen/Qwen3-ASR-0.6B", "zh", "制控", duration_sec=900.0)
    assert kwargs["language"] == "zh"
    assert kwargs["merge_vad"] is False
    assert kwargs["batch_size_s"] == 60
    assert kwargs["hotword"] == "制控"
    assert "return_time_stamps" not in kwargs


def test_nano_maps_zh_to_chinese_label() -> None:
    kwargs = build_generate_kwargs(NANO, "zh", "制控", duration_sec=900.0)
    assert kwargs["language"] == "中文"
    assert kwargs["sentence_timestamp"] is True
    assert kwargs["merge_vad"] is False
    assert kwargs["batch_size"] == 1
    assert "batch_size_s" not in kwargs
    assert kwargs["hotwords"] == ["制控"]
    assert "hotword" not in kwargs


def test_nano_supported_generate_keys() -> None:
    keys = supported_generate_param_keys(NANO)
    assert "sentence_timestamp" in keys
    assert "return_time_stamps" not in keys


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


def test_profile_supported_generate_keys_are_explicit() -> None:
    assert "sentence_timestamp" in supported_generate_param_keys(PARA)
    assert "use_itn" not in supported_generate_param_keys(PARA)
    assert "rich_transcription_postprocess" in supported_generate_param_keys(SENSE)
    assert "return_time_stamps" not in supported_generate_param_keys("Qwen/Qwen3-ASR-0.6B")
    assert "sentence_timestamp" not in supported_generate_param_keys("custom/generic-model")


def test_filter_generate_kwargs_for_model_records_filtered_params() -> None:
    warnings: list[str] = []
    out = filter_generate_kwargs_for_model(
        "custom/generic-model",
        {
            "language": "zh",
            "merge_vad": True,
            "sentence_timestamp": True,
            "return_time_stamps": True,
        },
        warnings.append,
    )

    assert out == {"language": "zh", "merge_vad": True}
    assert warnings == [
        "funasr_generate_param_filtered:sentence_timestamp",
        "funasr_generate_param_filtered:return_time_stamps",
    ]

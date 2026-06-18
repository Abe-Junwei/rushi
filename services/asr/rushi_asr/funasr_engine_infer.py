"""FunASR inference, generate kwargs fallback, and segmentation parse."""

from __future__ import annotations

import concurrent.futures
import logging
import os
from pathlib import Path
from typing import Any

from rushi_asr.asr_model_profile import (
    LONG_AUDIO_SEC,
    filter_generate_kwargs_for_model,
    funasr_language_for_model,
)
from rushi_asr.funasr_pipeline import recognizer_needs_punc_pipeline
from rushi_asr.inference_queue import get_inference_queue, reset_inference_queue_after_timeout
from rushi_asr.schemas import TranscriptionSegment
from rushi_asr.segmentation import segment_funasr_generate_result

log = logging.getLogger(__name__)

# FunASR AutoModel + generate() are not thread-safe; all inference goes through a single FIFO worker.
# Do not raise max_workers without a separate model instance per worker.

# Timeout budget for a single inference call (seconds).
# Formula: duration_sec * 4 + 300, clamped to [600, 7200].
# Aligns with Rust-side budget in transcribe_timeout.rs.
_INFERENCE_TIMEOUT_MIN: int = 600
_INFERENCE_TIMEOUT_MAX: int = 7200
_INFERENCE_TIMEOUT_FACTOR: float = 4.0
_INFERENCE_TIMEOUT_PADDING: int = 300


def _engine():
    import rushi_asr.funasr_engine as engine

    return engine


def _reset_inference_executor_after_timeout() -> None:
    reset_inference_queue_after_timeout()


def _inference_timeout_sec(duration_sec: float | None) -> float:
    if duration_sec is None or duration_sec <= 0 or duration_sec != duration_sec:  # NaN check
        return float(_INFERENCE_TIMEOUT_MIN)
    estimate = duration_sec * _INFERENCE_TIMEOUT_FACTOR + _INFERENCE_TIMEOUT_PADDING
    return max(_INFERENCE_TIMEOUT_MIN, min(_INFERENCE_TIMEOUT_MAX, estimate))


def _long_audio_sensevoice_retry_kwargs(language: str) -> dict[str, Any]:
    """Second pass when SenseVoice long audio returned text-only."""
    return {
        "language": language,
        "merge_vad": False,
        "batch_size_s": 60,
        "output_timestamp": True,
    }


def transcribe_with_funasr(
    wav_path: Path,
    _duration_sec: float | None,
    hotwords: str | None = None,
    out_warnings: list[str] | None = None,
) -> tuple[list[TranscriptionSegment], str, str | None]:
    """
    Returns (segments, engine_label, segmentation_mode). Raises RuntimeError on hard failures.

    ``hotwords``: space-separated bias string for FunASR ``hotword=`` when supported.
    """
    from rushi_asr.transcribe_windows import should_transcribe_by_windows, transcribe_by_windows

    hw = (hotwords or "").strip() or None
    if should_transcribe_by_windows(_duration_sec):
        return transcribe_by_windows(
            wav_path,
            float(_duration_sec),
            hotwords=hw,
            out_warnings=out_warnings,
        )
    return generate_and_parse_funasr(wav_path, _duration_sec, hw, out_warnings)


def generate_and_parse_funasr(
    wav_path: Path,
    _duration_sec: float | None,
    hotwords: str | None = None,
    out_warnings: list[str] | None = None,
) -> tuple[list[TranscriptionSegment], str, str | None]:
    """Run one FunASR generate + R3t-A segmentation parse (single WAV file)."""
    engine = _engine()
    model_id = engine.effective_funasr_model_id()
    if not model_id:
        raise RuntimeError("funasr_model_not_configured")
    if not engine.required_models_cached_guess(model_id):
        raise RuntimeError("funasr_models_not_ready")

    model = engine._get_model(model_id)
    raw_lang = os.environ.get("RUSHI_FUNASR_LANGUAGE", "zh").strip() or "zh"
    rushi_lang = engine.effective_funasr_language()
    if rushi_lang != raw_lang and out_warnings is not None:
        out_warnings.append(f"funasr_language_fallback:{raw_lang!r}->{rushi_lang!r}")
    language = funasr_language_for_model(model_id, rushi_lang)
    if language != rushi_lang and out_warnings is not None:
        out_warnings.append(f"funasr_language_model_map:{rushi_lang!r}->{language!r}")
    hw = hotwords

    def _warn(msg: str) -> None:
        if out_warnings is not None:
            out_warnings.append(msg)

    generate_kwargs = engine.funasr_generate_kwargs(model_id, language, hw, _duration_sec)
    needs_punc = recognizer_needs_punc_pipeline(model_id)
    long_audio = _duration_sec is not None and _duration_sec >= LONG_AUDIO_SEC

    def _generate(kwargs: dict[str, Any]) -> Any:
        timeout = _inference_timeout_sec(_duration_sec)
        frozen = dict(kwargs)
        future = get_inference_queue().submit(
            lambda: model.generate(input=str(wav_path), **frozen),
        )
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError as e:
            log.error("FunASR inference timed out after %.0fs for %s", timeout, wav_path)
            _reset_inference_executor_after_timeout()
            raise RuntimeError(
                f"funasr_inference_timeout: 推理超时（{timeout:.0f}s）；"
                "音频可能过长或系统资源不足，建议缩短音频或切换至更快模型。"
            ) from e

    def _run_generate(kwargs: dict[str, Any]) -> Any:
        strip_order = (
            "hotword",
            "hotwords",
            "batch_size_s",
            "batch_size_threshold_s",
            "rich_transcription_postprocess",
            "use_itn",
            "output_timestamp",
            "return_time_stamps",
            "sentence_timestamp",
            "batch_size_threshold_s",
            "batch_size_s",
            "merge_vad",
        )

        def _strip_one(current: dict[str, Any], key: str) -> dict[str, Any]:
            if key == "hotword" and hw:
                _warn("hotword_param_unsupported")
            elif key == "use_itn":
                _warn("funasr_use_itn_unsupported")
            elif key == "rich_transcription_postprocess":
                _warn("funasr_rich_postprocess_unsupported")
            elif key == "sentence_timestamp":
                _warn("sentence_timestamp_param_unsupported")
            elif key == "return_time_stamps":
                _warn("return_time_stamps_param_unsupported")
            return {k: v for k, v in current.items() if k != key}

        current = filter_generate_kwargs_for_model(model_id, dict(kwargs), _warn)
        with engine._runtime_lock:
            while True:
                try:
                    return _generate(current)
                except TypeError as te:
                    _warn(f"funasr_generate_typeerror:{te!s}")
                    stripped_key: str | None = None
                    for key in strip_order:
                        if key in current:
                            current = _strip_one(current, key)
                            stripped_key = key
                            break
                    if stripped_key is not None:
                        continue
                    if needs_punc:
                        minimal = {"language": language, "sentence_timestamp": True, "merge_vad": False}
                        try:
                            res = _generate(minimal)
                            _warn("funasr_generate_minimal_sentence_timestamp")
                            return res
                        except TypeError:
                            _warn("sentence_timestamp_param_unsupported")
                            return _generate({"language": language, "merge_vad": True})
                    return _generate({"language": language, "merge_vad": not long_audio})
                except Exception as e:  # noqa: BLE001
                    raise RuntimeError(f"funasr_generate_failed:{e!s}") from e

    res = _run_generate(generate_kwargs)

    if not res or not isinstance(res, list):
        raise RuntimeError("funasr_empty_result")

    r0: dict[str, Any] = res[0] if isinstance(res[0], dict) else {}
    engine_label = f"funasr+{model_id}"

    segs, mode = segment_funasr_generate_result(r0, _duration_sec, model_id, out_warnings)
    if segs:
        if mode != "sentence_info" and long_audio:
            _warn(f"segmentation_mode:{mode}")
        return segs, engine_label, mode

    if (
        long_audio
        and not needs_punc
        and str(r0.get("text") or "").strip()
    ):
        retry_kwargs = _long_audio_sensevoice_retry_kwargs(language)
        if hw:
            retry_kwargs["hotword"] = hw
        try:
            res2 = _run_generate(retry_kwargs)
            if res2 and isinstance(res2, list) and isinstance(res2[0], dict):
                segs2, mode2 = segment_funasr_generate_result(
                    res2[0], _duration_sec, model_id, out_warnings,
                )
                if segs2:
                    _warn("funasr_long_audio_retry_segments")
                    _warn(f"segmentation_mode:{mode2}")
                    return segs2, engine_label, mode2
        except TypeError:
            _warn("funasr_long_audio_retry_unsupported")

    if not str(r0.get("text") or "").strip():
        _warn(
            "funasr_no_timestamps: 模型返回全文但无分句时间戳且时长未知；未创建语段。"
            "请换用输出 sentence_info 的模型/参数，或在桌面端波形上拖选新建语段。"
        )
    return [], engine_label, mode if mode != "empty" else None

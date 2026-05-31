"""Optional FunASR / SenseVoice path (install `pip install -e ".[funasr]"` and set RUSHI_FUNASR_MODEL).

Model id examples: `iic/SenseVoiceSmall`, `paraformer-zh` (see FunASR docs).
"""

from __future__ import annotations

import concurrent.futures
import logging
import os
import threading
from pathlib import Path
from typing import Any

from rushi_asr.defaults import effective_funasr_model_id, effective_funasr_vad_model_id
from rushi_asr.funasr_pipeline import effective_funasr_punc_model_id, recognizer_needs_punc_pipeline
from rushi_asr.model_prepare import required_models_cached_guess
from rushi_asr.schemas import TranscriptionSegment
from rushi_asr.segmentation import (
    LONG_AUDIO_SEC,
    funasr_generate_kwargs,
    segment_funasr_generate_result,
)

log = logging.getLogger(__name__)

_model_singleton: Any = None
_model_loaded_id: str | None = None
_runtime_lock = threading.RLock()

_inference_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
_executor_lock = threading.Lock()

# Timeout budget for a single inference call (seconds).
# Formula: duration_sec * 4 + 300, clamped to [600, 7200].
# Aligns with Rust-side budget in transcribe_timeout.rs.
_INFERENCE_TIMEOUT_MIN: int = 600
_INFERENCE_TIMEOUT_MAX: int = 7200
_INFERENCE_TIMEOUT_FACTOR: float = 4.0
_INFERENCE_TIMEOUT_PADDING: int = 300


def runtime_lock() -> threading.RLock:
    """Shared lock for model prepare, load, and inference."""
    return _runtime_lock


def loaded_funasr_model_id() -> str | None:
    """Hub id of the AutoModel currently resident in memory (None if unloaded)."""
    with _runtime_lock:
        return _model_loaded_id


def invalidate_funasr_model_cache() -> None:
    """Drop loaded AutoModel so the next transcribe picks up new weights (e.g. after prepare)."""
    global _model_singleton, _model_loaded_id
    with _runtime_lock:
        _model_singleton = None
        _model_loaded_id = None


def _reset_inference_executor_after_timeout() -> None:
    global _inference_executor
    with _executor_lock:
        old = _inference_executor
        _inference_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        old.shutdown(wait=False, cancel_futures=True)


def _inference_timeout_sec(duration_sec: float | None) -> float:
    if duration_sec is None or duration_sec <= 0 or duration_sec != duration_sec:  # NaN check
        return float(_INFERENCE_TIMEOUT_MIN)
    estimate = duration_sec * _INFERENCE_TIMEOUT_FACTOR + _INFERENCE_TIMEOUT_PADDING
    return max(_INFERENCE_TIMEOUT_MIN, min(_INFERENCE_TIMEOUT_MAX, estimate))


_ALLOWED_FUNASR_LANG = frozenset({"zh", "en", "ja", "ko", "yue", "auto"})


def effective_funasr_language() -> str:
    raw = os.environ.get("RUSHI_FUNASR_LANGUAGE", "zh").strip() or "zh"
    return raw if raw in _ALLOWED_FUNASR_LANG else "zh"


def _get_model(model_id: str) -> Any:
    global _model_singleton, _model_loaded_id
    with _runtime_lock:
        if _model_singleton is not None and _model_loaded_id == model_id:
            return _model_singleton
        _model_singleton = None
        _model_loaded_id = None
        try:
            from funasr import AutoModel
        except ImportError as e:
            raise RuntimeError("funasr_not_installed") from e

        device = os.environ.get("RUSHI_FUNASR_DEVICE", "cpu")
        kwargs: dict[str, Any] = {"model": model_id, "trust_remote_code": True, "device": device}
        vad = effective_funasr_vad_model_id()
        if vad:
            kwargs["vad_model"] = vad
            kwargs["vad_kwargs"] = {
                "max_single_segment_time": int(os.environ.get("RUSHI_FUNASR_VAD_MAX_MS", "30000")),
            }
        punc = effective_funasr_punc_model_id(model_id)
        if punc:
            kwargs["punc_model"] = punc

        log.info(
            "loading FunASR model %s device=%s vad=%s punc=%s",
            model_id,
            device,
            vad or "-",
            punc or "-",
        )
        _model_singleton = AutoModel(**kwargs)
        _model_loaded_id = model_id
        return _model_singleton


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
    model_id = effective_funasr_model_id()
    if not model_id:
        raise RuntimeError("funasr_model_not_configured")
    if not required_models_cached_guess(model_id):
        raise RuntimeError("funasr_models_not_ready")

    model = _get_model(model_id)
    language = effective_funasr_language()
    raw_lang = os.environ.get("RUSHI_FUNASR_LANGUAGE", "zh").strip() or "zh"
    if language != raw_lang and out_warnings is not None:
        out_warnings.append(f"funasr_language_fallback:{raw_lang!r}->{language!r}")
    hw = hotwords

    def _warn(msg: str) -> None:
        if out_warnings is not None:
            out_warnings.append(msg)

    generate_kwargs = funasr_generate_kwargs(model_id, language, hw, _duration_sec)
    needs_punc = recognizer_needs_punc_pipeline(model_id)
    long_audio = _duration_sec is not None and _duration_sec >= LONG_AUDIO_SEC

    def _generate(kwargs: dict[str, Any]) -> Any:
        timeout = _inference_timeout_sec(_duration_sec)
        with _executor_lock:
            executor = _inference_executor
        future = executor.submit(model.generate, input=str(wav_path), **kwargs)
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
            "rich_transcription_postprocess",
            "use_itn",
            "output_timestamp",
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
            return {k: v for k, v in current.items() if k != key}

        current = dict(kwargs)
        with _runtime_lock:
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
    engine = f"funasr+{model_id}"

    segs, mode = segment_funasr_generate_result(r0, _duration_sec, model_id, out_warnings)
    if segs:
        if mode != "sentence_info" and long_audio:
            _warn(f"segmentation_mode:{mode}")
        return segs, engine, mode

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
                    return segs2, engine, mode2
        except TypeError:
            _warn("funasr_long_audio_retry_unsupported")

    if not str(r0.get("text") or "").strip():
        _warn(
            "funasr_no_timestamps: 模型返回全文但无分句时间戳且时长未知；未创建语段。"
            "请换用输出 sentence_info 的模型/参数，或在桌面端波形上拖选新建语段。"
        )
    return [], engine, mode if mode != "empty" else None

"""
Optional FunASR / SenseVoice path (install `pip install -e ".[funasr]"` and set RUSHI_FUNASR_MODEL).

Model id examples: `iic/SenseVoiceSmall`, `paraformer-zh` (see FunASR docs).
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Any

from rushi_asr.defaults import effective_funasr_model_id
from rushi_asr.schemas import TranscriptionSegment

log = logging.getLogger(__name__)

_model_singleton: Any = None
_model_init_lock = threading.Lock()
_inference_lock = threading.Lock()

_ALLOWED_FUNASR_LANG = frozenset({"zh", "en", "ja", "ko", "yue", "auto"})


def _get_model(model_id: str) -> Any:
    global _model_singleton
    with _model_init_lock:
        if _model_singleton is not None:
            return _model_singleton
        try:
            from funasr import AutoModel
        except ImportError as e:
            raise RuntimeError("funasr_not_installed") from e

        device = os.environ.get("RUSHI_FUNASR_DEVICE", "cpu")
        kwargs: dict[str, Any] = {"model": model_id, "trust_remote_code": True, "device": device}
        vad = os.environ.get("RUSHI_FUNASR_VAD_MODEL", "fsmn-vad").strip()
        if vad:
            kwargs["vad_model"] = vad
            kwargs["vad_kwargs"] = {
                "max_single_segment_time": int(os.environ.get("RUSHI_FUNASR_VAD_MAX_MS", "30000")),
            }

        log.info("loading FunASR model %s device=%s", model_id, device)
        _model_singleton = AutoModel(**kwargs)
        return _model_singleton


def _segments_from_sentence_info(sentence_info: list[dict[str, Any]]) -> list[TranscriptionSegment]:
    segs: list[TranscriptionSegment] = []
    for row in sentence_info:
        # FunASR variants: ms or seconds
        start = row.get("start") or row.get("begin")
        end = row.get("end")
        if start is None or end is None:
            continue
        try:
            s = float(start)
            e = float(end)
        except (TypeError, ValueError):
            continue
        # Heuristic: values clearly in ms domain; avoid single threshold at 2000 alone.
        if s >= 500.0 or e >= 500.0:
            s, e = s / 1000.0, e / 1000.0
        text = str(row.get("text") or row.get("spk") or "").strip()
        conf = row.get("confidence")
        conf_f: float | None
        try:
            conf_f = float(conf) if conf is not None else None
        except (TypeError, ValueError):
            conf_f = None
        low = bool(row.get("low_confidence")) or (conf_f is None)
        if conf_f is not None:
            conf_f = max(0.0, min(1.0, conf_f))
        lo = max(0.0, min(s, e))
        hi = max(0.0, max(s, e))
        segs.append(
            TranscriptionSegment(
                start_sec=lo,
                end_sec=max(lo, hi),
                text=text,
                confidence=conf_f,
                low_confidence=low,
            ),
        )
    return segs


def transcribe_with_funasr(
    wav_path: Path,
    _duration_sec: float | None,
    hotwords: str | None = None,
    out_warnings: list[str] | None = None,
) -> tuple[list[TranscriptionSegment], str]:
    """
    Returns (segments, engine_label). Raises RuntimeError on hard failures.

    ``hotwords``: space-separated bias string for FunASR ``hotword=`` when supported.
    """
    model_id = effective_funasr_model_id()
    if not model_id:
        raise RuntimeError("funasr_model_not_configured")

    model = _get_model(model_id)
    raw_lang = os.environ.get("RUSHI_FUNASR_LANGUAGE", "zh").strip() or "zh"
    language = raw_lang if raw_lang in _ALLOWED_FUNASR_LANG else "zh"
    if language != raw_lang and out_warnings is not None:
        out_warnings.append(f"funasr_language_fallback:{raw_lang!r}->{language!r}")
    hw = (hotwords or "").strip() or None

    def _warn(msg: str) -> None:
        if out_warnings is not None:
            out_warnings.append(msg)

    with _inference_lock:
        try:
            if hw:
                try:
                    res = model.generate(
                        input=str(wav_path),
                        language=language,
                        merge_vad=True,
                        hotword=hw,
                    )
                except TypeError:
                    _warn("hotword_param_unsupported")
                    res = model.generate(input=str(wav_path), language=language, merge_vad=True)
            else:
                res = model.generate(input=str(wav_path), language=language, merge_vad=True)
        except TypeError:
            try:
                res = model.generate(input=str(wav_path))
            except Exception as e:  # noqa: BLE001
                raise RuntimeError(f"funasr_generate_failed:{e!s}") from e
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"funasr_generate_failed:{e!s}") from e

    if not res or not isinstance(res, list):
        raise RuntimeError("funasr_empty_result")

    r0: dict[str, Any] = res[0] if isinstance(res[0], dict) else {}
    engine = f"funasr+{model_id}"

    if isinstance(r0.get("sentence_info"), list):
        segs = _segments_from_sentence_info(r0["sentence_info"])
        if segs:
            return segs, engine

    text = str(r0.get("text") or "").strip()
    if not text:
        _warn("funasr_no_sentence_segments")
        return [], engine
    # 有全文但无 sentence_info：优先生成整轨单语段，避免桌面端「拉取成功但语段列表为空」
    if _duration_sec is not None and _duration_sec > 0:
        _warn(
            "funasr_whole_track_fallback: 模型返回全文但无分句时间戳；已生成整轨单语段，"
            "可在波形上拖选拆分或换用输出 sentence_info 的模型。"
        )
        return [
            TranscriptionSegment(
                start_sec=0.0,
                end_sec=float(_duration_sec),
                text=text,
                low_confidence=True,
                detail="funasr_whole_track_fallback",
            ),
        ], engine
    _warn(
        "funasr_no_timestamps: 模型返回全文但无分句时间戳且时长未知；未创建语段。"
        "请换用输出 sentence_info 的模型/参数，或在桌面端波形上拖选新建语段。"
    )
    return [], engine

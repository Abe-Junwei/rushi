"""
Optional FunASR / SenseVoice path (install `pip install -e ".[funasr]"` and set RUSHI_FUNASR_MODEL).

Model id examples: `iic/SenseVoiceSmall`, `paraformer-zh` (see FunASR docs).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from rushi_asr.schemas import TranscriptionSegment

log = logging.getLogger(__name__)

_model_singleton: Any = None


def _get_model(model_id: str) -> Any:
    global _model_singleton
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
        # Heuristic: values > 1000 treated as milliseconds
        if s > 2000 or e > 2000:
            s, e = s / 1000.0, e / 1000.0
        text = str(row.get("text") or row.get("spk") or "").strip()
        conf = row.get("confidence")
        conf_f: float | None
        try:
            conf_f = float(conf) if conf is not None else None
        except (TypeError, ValueError):
            conf_f = None
        low = bool(row.get("low_confidence")) or (conf_f is None)
        segs.append(
            TranscriptionSegment(
                start_sec=max(0.0, s),
                end_sec=max(0.0, e),
                text=text,
                confidence=conf_f,
                low_confidence=low,
            ),
        )
    return segs


def transcribe_with_funasr(wav_path: Path, duration_sec: float | None) -> tuple[list[TranscriptionSegment], str]:
    """
    Returns (segments, engine_label). Raises RuntimeError on hard failures.
    """
    model_id = os.environ.get("RUSHI_FUNASR_MODEL", "").strip()
    if not model_id:
        raise RuntimeError("funasr_model_not_configured")

    model = _get_model(model_id)
    language = os.environ.get("RUSHI_FUNASR_LANGUAGE", "zh").strip() or "zh"
    try:
        res = model.generate(input=str(wav_path), language=language, merge_vad=True)
    except TypeError:
        res = model.generate(input=str(wav_path))
    if not res or not isinstance(res, list):
        raise RuntimeError("funasr_empty_result")

    r0: dict[str, Any] = res[0] if isinstance(res[0], dict) else {}
    engine = f"funasr+{model_id}"

    if isinstance(r0.get("sentence_info"), list):
        segs = _segments_from_sentence_info(r0["sentence_info"])
        if segs:
            return segs, engine

    text = str(r0.get("text") or "").strip()
    dur = duration_sec if duration_sec is not None else 0.0
    # 有全文但无 sentence_info：标为单段回退；无文本时标低置信便于验收区分「引擎无输出」
    low = not bool(text)
    return [
        TranscriptionSegment(
            start_sec=0.0,
            end_sec=max(dur, 0.01),
            text=text,
            confidence=None,
            low_confidence=low,
            detail="single_segment_fallback" if text else "funasr_empty_text",
        ),
    ], engine

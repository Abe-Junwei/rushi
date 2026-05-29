"""FunASR result → timed segments (R3t-A single segmentation kernel for R3e-B)."""

from __future__ import annotations

from typing import Any

from rushi_asr.funasr_pipeline import recognizer_needs_punc_pipeline
from rushi_asr.schemas import TranscriptionSegment

# R3t-A: long audio must not end as whole-track-only; short clips may.
LONG_AUDIO_SEC = 180.0
SHORT_WHOLE_TRACK_MAX_SEC = 30.0

SegmentationMode = str  # sentence_info | vad_timestamp | whole_track_fallback | empty


def funasr_generate_kwargs(
    model_id: str,
    language: str,
    hotwords: str | None,
    duration_sec: float | None = None,
) -> dict[str, Any]:
    """Build FunASR generate() kwargs; long audio favors VAD-visible segments."""
    kwargs: dict[str, Any] = {"language": language}
    long_audio = duration_sec is not None and duration_sec >= LONG_AUDIO_SEC
    if recognizer_needs_punc_pipeline(model_id):
        kwargs["sentence_timestamp"] = True
        kwargs["merge_vad"] = False
    else:
        # SenseVoice / Nano: keep VAD boundaries on long audio (avoid one merged blob).
        kwargs["merge_vad"] = not long_audio
        if long_audio:
            kwargs["batch_size_s"] = 60
    if hotwords:
        kwargs["hotword"] = hotwords
    return kwargs


def segment_funasr_generate_result(
    r0: dict[str, Any],
    duration_sec: float | None,
    model_id: str,
    out_warnings: list[str] | None = None,
) -> tuple[list[TranscriptionSegment], SegmentationMode]:
    """Parse one FunASR generate() row into timed segments."""
    def _warn(msg: str) -> None:
        if out_warnings is not None:
            out_warnings.append(msg)

    if isinstance(r0.get("sentence_info"), list):
        segs = segments_from_sentence_info(r0["sentence_info"], duration_sec)
        if segs:
            return segs, "sentence_info"

    text = str(r0.get("text") or "").strip()
    ts = r0.get("timestamp")
    if text and ts is not None:
        vad_segs = segments_from_timestamp_field(text, ts, duration_sec)
        if vad_segs:
            _warn("funasr_vad_timestamp_segments")
            return vad_segs, "vad_timestamp"

    if not text:
        _warn("funasr_no_sentence_segments")
        return [], "empty"

    if _allow_whole_track_fallback(duration_sec):
        hint = (
            "funasr_whole_track_fallback: 模型返回全文但无分句时间戳；已生成整轨单语段，"
            "可在波形上拖选拆分或换用输出 sentence_info 的模型。"
        )
        if recognizer_needs_punc_pipeline(model_id):
            hint += " Paraformer 需 ct-punc 权重：请在环境页重新下载当前模型。"
        _warn(hint)
        return [_whole_track_segment(text, duration_sec)], "whole_track_fallback"

    _warn(
        "funasr_long_audio_no_segments: 长音频未得到分句时间戳；未生成整轨占位语段。"
        "请换用 Paraformer（VAD+标点）或检查 VAD/标点权重是否已缓存。"
    )
    return [], "empty"


def segments_from_sentence_info(
    sentence_info: list[dict[str, Any]],
    duration_sec: float | None,
) -> list[TranscriptionSegment]:
    segs: list[TranscriptionSegment] = []
    for row in sentence_info:
        start = _row_start_sec(row)
        end = _row_end_sec(row)
        if start is None or end is None:
            continue
        s = normalize_funasr_time(start, duration_sec)
        e = normalize_funasr_time(end, duration_sec)
        text = _row_text(row)
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


def segments_from_timestamp_field(
    text: str,
    timestamp: Any,
    duration_sec: float | None,
) -> list[TranscriptionSegment]:
    """Group FunASR ``timestamp`` pairs into VAD-scale segments (ms → sec)."""
    pairs = _parse_timestamp_pairs(timestamp)
    if len(pairs) < 2:
        return []

    spans: list[tuple[float, float]] = []
    gap_ms = 800.0
    cur_start, cur_end = pairs[0]
    for start_ms, end_ms in pairs[1:]:
        if start_ms - cur_end > gap_ms:
            spans.append((cur_start, cur_end))
            cur_start, cur_end = start_ms, end_ms
        else:
            cur_end = max(cur_end, end_ms)
    spans.append((cur_start, cur_end))

    if not spans:
        return []

    total_ms = max(end for _, end in spans) - min(start for start, _ in spans)
    if total_ms <= 0:
        return []

    chars = list(text.replace(" ", ""))
    if not chars:
        chars = list(text)
    if not chars:
        return []

    segs: list[TranscriptionSegment] = []
    cursor = 0
    for start_ms, end_ms in spans:
        span_ms = max(end_ms - start_ms, 1.0)
        share = span_ms / total_ms
        take = max(1, min(len(chars) - cursor, round(len(chars) * share)))
        chunk = "".join(chars[cursor : cursor + take]).strip()
        cursor += take
        if not chunk:
            continue
        lo = normalize_funasr_time(start_ms / 1000.0, duration_sec)
        hi = normalize_funasr_time(end_ms / 1000.0, duration_sec)
        segs.append(
            TranscriptionSegment(
                start_sec=lo,
                end_sec=max(lo, hi),
                text=chunk,
                low_confidence=True,
                detail="funasr_vad_timestamp",
            ),
        )
    if cursor < len(chars) and segs:
        tail = "".join(chars[cursor:]).strip()
        if tail:
            last = segs[-1]
            segs[-1] = last.model_copy(update={"text": f"{last.text}{tail}"})
    return segs


def normalize_funasr_time(value: float, duration_sec: float | None) -> float:
    if value < 0:
        return 0.0
    if duration_sec is not None and duration_sec > 0:
        if value > max(duration_sec * 2.0 + 5.0, 600.0):
            return value / 1000.0
        return value
    if value >= 10_000.0:
        return value / 1000.0
    return value


def _allow_whole_track_fallback(duration_sec: float | None) -> bool:
    if duration_sec is None or duration_sec <= 0:
        return False
    return duration_sec < SHORT_WHOLE_TRACK_MAX_SEC


def _whole_track_segment(text: str, duration_sec: float | None) -> TranscriptionSegment:
    end = float(duration_sec) if duration_sec is not None and duration_sec > 0 else 0.0
    return TranscriptionSegment(
        start_sec=0.0,
        end_sec=end,
        text=text,
        low_confidence=True,
        detail="funasr_whole_track_fallback",
    )


def _parse_timestamp_pairs(timestamp: Any) -> list[tuple[float, float]]:
    if not isinstance(timestamp, list):
        return []
    pairs: list[tuple[float, float]] = []
    for item in timestamp:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            try:
                pairs.append((float(item[0]), float(item[1])))
            except (TypeError, ValueError):
                continue
        elif isinstance(item, dict):
            start = item.get("start") or item.get("begin") or item.get("start_time")
            end = item.get("end") or item.get("end_time")
            if start is not None and end is not None:
                try:
                    pairs.append((float(start), float(end)))
                except (TypeError, ValueError):
                    continue
    return pairs


def _row_start_sec(row: dict[str, Any]) -> float | None:
    if "start" in row:
        start = row.get("start")
    else:
        start = row.get("begin")
    if start is None:
        return None
    try:
        return float(start)
    except (TypeError, ValueError):
        return None


def _row_end_sec(row: dict[str, Any]) -> float | None:
    end = row.get("end")
    if end is None:
        return None
    try:
        return float(end)
    except (TypeError, ValueError):
        return None


def _row_text(row: dict[str, Any]) -> str:
    text_raw = row.get("text")
    if text_raw is None:
        text_raw = row.get("sentence")
    if text_raw is None:
        text_raw = row.get("spk")
    if isinstance(text_raw, list):
        return " ".join(str(x) for x in text_raw).strip()
    return str(text_raw or "").strip()


# R3e-B must import this alias — do not fork a second VAD/segmentation implementation.
segment_audio_to_transcription_segments = segment_funasr_generate_result

use super::types::{OnlineSegmentNormalizeOptions, PUNCT_BREAK};
use super::word_axis::{
    refine_long_speech_segments, timed_words_from_json_array, timed_words_to_segments,
};
use serde_json::json;

pub fn refine_online_transcribe_segments(v: &mut serde_json::Value, engine: &str) -> Option<usize> {
    let timed_json = v.get("timed_words")?.as_array()?;
    if timed_json.len() < 2 {
        return None;
    }
    let segments = v.get("segments")?.as_array()?.clone();
    if segments.is_empty() {
        return None;
    }
    let opts = OnlineSegmentNormalizeOptions::refine_opts_for_engine(engine);
    let timed = timed_words_from_json_array(timed_json);
    let refined = refine_long_speech_segments(segments, &timed, &opts);
    if refined.len() == v.get("segments")?.as_array()?.len() {
        return None;
    }
    let new_count = refined.len();
    v["segments"] = json!(refined);
    Some(new_count)
}

pub fn proportional_segments_from_text(
    full_text: &str,
    range_start: f64,
    range_end: f64,
) -> Vec<serde_json::Value> {
    let text = full_text.trim();
    let duration_sec = (range_end - range_start).max(0.0);
    if text.is_empty() || duration_sec <= 0.0 {
        return Vec::new();
    }
    let mut parts: Vec<String> = Vec::new();
    let mut buf = String::new();
    for ch in text.chars() {
        buf.push(ch);
        if PUNCT_BREAK.contains(&ch) {
            let s = buf.trim().to_string();
            if !s.is_empty() {
                parts.push(s);
            }
            buf.clear();
        }
    }
    let tail = buf.trim();
    if !tail.is_empty() {
        parts.push(tail.to_string());
    }
    if parts.len() < 2 {
        return Vec::new();
    }
    let total_chars: usize = parts.iter().map(|p| p.chars().count()).sum();
    if total_chars == 0 {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(parts.len());
    let mut cursor = 0.0_f64;
    for (i, part) in parts.iter().enumerate() {
        let weight = part.chars().count() as f64 / total_chars as f64;
        let seg_dur = if i + 1 == parts.len() {
            (duration_sec - cursor).max(0.0)
        } else {
            duration_sec * weight
        };
        let start = range_start + cursor;
        let end = (range_start + cursor + seg_dur).min(range_end);
        cursor += seg_dur;
        out.push(json!({
            "start_sec": start,
            "end_sec": end.max(start),
            "text": part.trim(),
            "confidence": serde_json::Value::Null,
            "low_confidence": false,
            "kind": "placeholder",
        }));
    }
    out
}

fn tier_c_time_range(v: &serde_json::Value, audio_duration_sec: Option<f64>) -> (f64, f64) {
    let probe_end = audio_duration_sec
        .or_else(|| v.get("duration_sec").and_then(|x| x.as_f64()))
        .unwrap_or(0.0);
    if let Some(seg) = v
        .get("segments")
        .and_then(|s| s.as_array())
        .and_then(|a| a.first())
    {
        let start = seg.get("start_sec").and_then(|x| x.as_f64()).unwrap_or(0.0);
        let end = seg.get("end_sec").and_then(|x| x.as_f64()).unwrap_or(start);
        let span = end - start;
        if span > 0.0
            && span.is_finite()
            && (probe_end <= 0.0 || (end <= probe_end + 1.0 && span <= probe_end + 1.0))
        {
            return (start, end);
        }
    }
    (0.0, probe_end.max(0.0))
}

fn segment_count(v: &serde_json::Value) -> usize {
    v.get("segments")
        .and_then(|s| s.as_array())
        .map(|a| a.len())
        .unwrap_or(0)
}

fn single_segment_is_tier_a_speech(v: &serde_json::Value) -> bool {
    let Some(seg) = v
        .get("segments")
        .and_then(|s| s.as_array())
        .and_then(|a| a.first())
    else {
        return false;
    };
    seg.get("kind")
        .and_then(|k| k.as_str())
        .is_some_and(|k| k == "speech")
}

pub fn normalize_online_transcribe_json(
    v: &mut serde_json::Value,
    audio_duration_sec: Option<f64>,
    opts: &OnlineSegmentNormalizeOptions,
) -> Vec<String> {
    let mut extra = Vec::new();
    if segment_count(v) >= 2 {
        return extra;
    }
    let full_text = v
        .get("full_text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if full_text.is_empty() {
        return extra;
    }

    if let Some(words) = v.get("timed_words").and_then(|w| w.as_array()) {
        let timed = timed_words_from_json_array(words);
        if timed.len() >= 2 {
            let segs = timed_words_to_segments(&timed, opts);
            if segs.len() >= 2 {
                v["segments"] = json!(segs);
                return extra;
            }
        }
    }

    if !opts.allow_tier_c_fallback || single_segment_is_tier_a_speech(v) {
        return extra;
    }
    let (range_start, range_end) = tier_c_time_range(v, audio_duration_sec);
    if range_end <= range_start {
        return extra;
    }
    let segs = proportional_segments_from_text(&full_text, range_start, range_end);
    if segs.len() >= 2 {
        v["segments"] = json!(segs);
        extra.push("online_segmentation_proportional".to_string());
    }
    extra
}

#[cfg(test)]
pub(crate) fn segment_count_for_test(v: &serde_json::Value) -> usize {
    segment_count(v)
}

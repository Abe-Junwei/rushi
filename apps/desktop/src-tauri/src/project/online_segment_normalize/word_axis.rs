use super::types::{OnlineSegmentNormalizeOptions, TimedWord, TERMINAL_PUNCT, WEAK_PUNCT};
use serde_json::json;

fn ends_with_terminal_punct(s: &str) -> bool {
    s.trim()
        .chars()
        .last()
        .is_some_and(|c| TERMINAL_PUNCT.contains(&c))
}

fn ends_with_weak_punct(s: &str) -> bool {
    s.trim()
        .chars()
        .last()
        .is_some_and(|c| WEAK_PUNCT.contains(&c))
}

fn ends_with_any_punct(s: &str) -> bool {
    ends_with_terminal_punct(s) || ends_with_weak_punct(s)
}

fn should_break_on_punct(
    buf: &str,
    seg_start_ms: u64,
    seg_end_ms: u64,
    opts: &OnlineSegmentNormalizeOptions,
) -> bool {
    if opts.break_on_punctuation && ends_with_terminal_punct(buf) {
        return true;
    }
    if opts.break_on_weak_punctuation && ends_with_weak_punct(buf) {
        let dur_ms = seg_end_ms.saturating_sub(seg_start_ms);
        return dur_ms >= opts.weak_punct_min_duration_ms
            || buf.chars().count() >= opts.weak_punct_min_chars;
    }
    false
}

fn buf_exceeds_max_subsegment(
    seg_start_ms: u64,
    seg_end_ms: u64,
    buf: &str,
    opts: &OnlineSegmentNormalizeOptions,
) -> bool {
    if buf.trim().is_empty() {
        return false;
    }
    let dur_sec = (seg_end_ms.saturating_sub(seg_start_ms)) as f64 / 1000.0;
    if opts.max_segment_sec.is_some_and(|max| dur_sec > max) {
        return true;
    }
    opts.max_segment_chars
        .is_some_and(|max| buf.chars().count() > max)
}

fn text_for_forced_break(buf: &str, opts: &OnlineSegmentNormalizeOptions) -> String {
    let t = buf.trim();
    if t.is_empty() {
        return String::new();
    }
    if !opts.inject_comma_on_forced_break || ends_with_any_punct(t) {
        t.to_string()
    } else {
        format!("{t}，")
    }
}

fn append_word_piece(buf: &mut String, piece: &str, opts: &OnlineSegmentNormalizeOptions) {
    if piece.is_empty() {
        return;
    }
    if opts.join_with_space && !buf.is_empty() {
        buf.push(' ');
    }
    buf.push_str(piece);
}

pub fn timed_words_to_segments(
    words: &[TimedWord],
    opts: &OnlineSegmentNormalizeOptions,
) -> Vec<serde_json::Value> {
    if words.is_empty() {
        return Vec::new();
    }
    let gap_ms = opts.gap_ms;
    let mut out: Vec<serde_json::Value> = Vec::new();
    let mut seg_start_ms: Option<u64> = None;
    let mut seg_end_ms: u64 = 0;
    let mut buf = String::new();

    for w in words {
        let piece = w.text.trim();
        if piece.is_empty() {
            continue;
        }
        match seg_start_ms {
            None => {
                seg_start_ms = Some(w.start_ms);
                seg_end_ms = w.end_ms.max(w.start_ms);
                append_word_piece(&mut buf, piece, opts);
            }
            Some(s0) => {
                let gap = w.start_ms.saturating_sub(seg_end_ms);
                let natural_break =
                    gap > gap_ms || should_break_on_punct(&buf, s0, seg_end_ms, opts);
                let force_break =
                    !natural_break && buf_exceeds_max_subsegment(s0, seg_end_ms, &buf, opts);
                if natural_break || force_break {
                    let seg_text = if force_break {
                        text_for_forced_break(&buf, opts)
                    } else {
                        buf.trim().to_string()
                    };
                    push_segment_json(&mut out, s0, seg_end_ms, &seg_text);
                    seg_start_ms = Some(w.start_ms);
                    seg_end_ms = w.end_ms.max(w.start_ms);
                    buf.clear();
                    append_word_piece(&mut buf, piece, opts);
                } else {
                    append_word_piece(&mut buf, piece, opts);
                    seg_end_ms = w.end_ms.max(seg_end_ms);
                }
            }
        }
    }
    if let Some(s0) = seg_start_ms {
        push_segment_json(&mut out, s0, seg_end_ms, &buf);
    }
    out
}

fn push_segment_json(out: &mut Vec<serde_json::Value>, start_ms: u64, end_ms: u64, text: &str) {
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    let start_sec = start_ms as f64 / 1000.0;
    let end_sec = (end_ms.max(start_ms)) as f64 / 1000.0;
    out.push(json!({
        "start_sec": start_sec,
        "end_sec": end_sec,
        "text": text,
        "confidence": serde_json::Value::Null,
        "low_confidence": false,
        "kind": "speech",
    }));
}

pub fn long_span_needs_word_refinement(
    dur_sec: f64,
    char_count: usize,
    word_count: usize,
    opts: &OnlineSegmentNormalizeOptions,
) -> bool {
    if word_count < 2 {
        return false;
    }
    let sec_gate = opts.refine_span_min_sec.unwrap_or(f64::INFINITY);
    let char_gate = opts.refine_span_min_chars.unwrap_or(usize::MAX);
    dur_sec > sec_gate || char_count > char_gate
}

pub fn words_overlapping_range(words: &[TimedWord], start_ms: u64, end_ms: u64) -> Vec<TimedWord> {
    words
        .iter()
        .filter(|w| w.end_ms > start_ms && w.start_ms < end_ms)
        .cloned()
        .collect()
}

pub fn refine_long_speech_segments(
    segments: Vec<serde_json::Value>,
    timed_words: &[TimedWord],
    opts: &OnlineSegmentNormalizeOptions,
) -> Vec<serde_json::Value> {
    if segments.is_empty() || timed_words.len() < 2 {
        return segments;
    }
    let mut out = Vec::with_capacity(segments.len());
    for seg in segments {
        let start_sec = seg.get("start_sec").and_then(|x| x.as_f64()).unwrap_or(0.0);
        let end_sec = seg
            .get("end_sec")
            .and_then(|x| x.as_f64())
            .unwrap_or(start_sec);
        let text = seg.get("text").and_then(|t| t.as_str()).unwrap_or("");
        let start_ms = (start_sec * 1000.0).max(0.0) as u64;
        let end_ms = (end_sec * 1000.0).max(start_sec * 1000.0) as u64;
        let dur_sec = (end_sec - start_sec).max(0.0);
        let words = words_overlapping_range(timed_words, start_ms, end_ms);
        if !long_span_needs_word_refinement(dur_sec, text.chars().count(), words.len(), opts) {
            out.push(seg);
            continue;
        }
        let split = timed_words_to_segments(&words, opts);
        if split.len() >= 2 {
            out.extend(split);
        } else {
            out.push(seg);
        }
    }
    out
}

pub fn timed_words_from_json_array(words: &[serde_json::Value]) -> Vec<TimedWord> {
    words
        .iter()
        .filter_map(|w| {
            Some(TimedWord {
                text: w.get("text")?.as_str()?.trim().to_string(),
                start_ms: w.get("start_ms")?.as_u64()?,
                end_ms: w.get("end_ms")?.as_u64()?,
            })
        })
        .collect()
}

pub fn timed_words_to_json(words: &[TimedWord]) -> Vec<serde_json::Value> {
    words
        .iter()
        .map(|w| {
            json!({
                "text": w.text,
                "start_ms": w.start_ms,
                "end_ms": w.end_ms,
            })
        })
        .collect()
}

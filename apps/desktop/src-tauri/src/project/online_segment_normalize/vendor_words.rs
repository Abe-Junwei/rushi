use super::types::{OnlineSegmentNormalizeOptions, TimedWord};
use super::word_axis::timed_words_to_segments;

fn json_f64(v: &serde_json::Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_i64().map(|n| n as f64))
        .or_else(|| v.as_u64().map(|n| n as f64))
}

pub fn funasr_word_piece(w: &serde_json::Value) -> String {
    let piece = w
        .get("text")
        .or_else(|| w.get("word"))
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim();
    let mut out = piece.to_string();
    if let Some(p) = w.get("punctuation").and_then(|x| x.as_str()) {
        out.push_str(p);
    }
    out
}

pub fn funasr_file_words_to_timed(
    words: &[serde_json::Value],
    fallback_begin_ms: f64,
) -> Vec<TimedWord> {
    let mut out = Vec::new();
    for w in words {
        let piece = funasr_word_piece(w);
        if piece.trim().is_empty() {
            continue;
        }
        let w_begin = w
            .get("begin_time")
            .and_then(json_f64)
            .unwrap_or(fallback_begin_ms);
        let w_end = w
            .get("end_time")
            .and_then(json_f64)
            .unwrap_or(w_begin)
            .max(w_begin);
        out.push(TimedWord {
            text: piece,
            start_ms: w_begin.max(0.0) as u64,
            end_ms: w_end.max(w_begin) as u64,
        });
    }
    out
}

pub fn assemblyai_words_to_timed_words(words: &[serde_json::Value]) -> Vec<TimedWord> {
    let mut out = Vec::new();
    for w in words {
        let piece = w.get("text").and_then(|x| x.as_str()).unwrap_or("").trim();
        if piece.is_empty() {
            continue;
        }
        let start_ms = w
            .get("start")
            .and_then(|x| x.as_f64())
            .unwrap_or(0.0)
            .max(0.0) as u64;
        let end_ms = w
            .get("end")
            .and_then(|x| x.as_f64())
            .unwrap_or(start_ms as f64)
            .max(start_ms as f64) as u64;
        out.push(TimedWord {
            text: piece.to_string(),
            start_ms,
            end_ms,
        });
    }
    out
}

pub fn deepgram_words_to_timed_words(words: &[serde_json::Value]) -> Vec<TimedWord> {
    let mut out = Vec::new();
    for w in words {
        let piece = w.get("word").and_then(|x| x.as_str()).unwrap_or("").trim();
        if piece.is_empty() {
            continue;
        }
        let start_ms = w
            .get("start")
            .and_then(json_f64)
            .map(|s| (s * 1000.0).max(0.0) as u64)
            .unwrap_or(0);
        let end_ms = w
            .get("end")
            .and_then(json_f64)
            .map(|e| (e * 1000.0).max(start_ms as f64) as u64)
            .unwrap_or(start_ms);
        out.push(TimedWord {
            text: piece.to_string(),
            start_ms,
            end_ms,
        });
    }
    out
}

pub fn openai_words_to_timed_words(words: &[serde_json::Value]) -> Vec<TimedWord> {
    let mut out = Vec::new();
    for w in words {
        let piece = w.get("word").and_then(|x| x.as_str()).unwrap_or("").trim();
        if piece.is_empty() {
            continue;
        }
        let start_ms = w
            .get("start")
            .and_then(json_f64)
            .map(|s| (s * 1000.0).max(0.0) as u64)
            .unwrap_or(0);
        let end_ms = w
            .get("end")
            .and_then(json_f64)
            .map(|e| (e * 1000.0).max(start_ms as f64) as u64)
            .unwrap_or(start_ms);
        out.push(TimedWord {
            text: piece.to_string(),
            start_ms,
            end_ms,
        });
    }
    out
}

pub fn assemblyai_words_to_segments(words: &[serde_json::Value]) -> Vec<serde_json::Value> {
    let timed = assemblyai_words_to_timed_words(words);
    timed_words_to_segments(&timed, &OnlineSegmentNormalizeOptions::english_words())
}

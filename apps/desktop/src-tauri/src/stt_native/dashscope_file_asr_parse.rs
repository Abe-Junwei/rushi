//! Fun-ASR 文件转写结果解析（`transcription_url` 下载体）。

use serde_json::{json, Value};

use crate::project::online_segment_normalize::{
    funasr_file_words_to_timed, funasr_word_piece, refine_long_speech_segments,
    timed_words_to_json, OnlineSegmentNormalizeOptions,
};

type FunasrFileTranscriptionParse = (Vec<Value>, String, Option<f64>, Vec<Value>);

fn json_f64(v: &Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_i64().map(|n| n as f64))
        .or_else(|| v.as_u64().map(|n| n as f64))
}

fn assemble_text_from_words(words: &[Value]) -> String {
    words
        .iter()
        .map(funasr_word_piece)
        .filter(|s| !s.trim().is_empty())
        .collect()
}

fn push_speech_segment(out: &mut Vec<Value>, start_ms: u64, end_ms: u64, text: &str) {
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    out.push(json!({
        "start_sec": start_ms as f64 / 1000.0,
        "end_sec": end_ms.max(start_ms) as f64 / 1000.0,
        "text": text,
        "confidence": Value::Null,
        "low_confidence": false,
        "kind": "speech",
    }));
}

fn segments_for_sentence(sentence: &Value) -> (Vec<Value>, Vec<Value>) {
    let begin_ms = sentence.get("begin_time").and_then(json_f64).unwrap_or(0.0);
    let end_ms = sentence
        .get("end_time")
        .and_then(json_f64)
        .unwrap_or(begin_ms)
        .max(begin_ms);
    let fallback_text = sentence
        .get("text")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let Some(words_json) = sentence.get("words").and_then(|w| w.as_array()) else {
        if fallback_text.is_empty() {
            return (Vec::new(), Vec::new());
        }
        let mut segments = Vec::new();
        push_speech_segment(
            &mut segments,
            begin_ms.max(0.0) as u64,
            end_ms.max(begin_ms) as u64,
            &fallback_text,
        );
        return (segments, Vec::new());
    };

    if words_json.is_empty() {
        if fallback_text.is_empty() {
            return (Vec::new(), Vec::new());
        }
        let mut segments = Vec::new();
        push_speech_segment(
            &mut segments,
            begin_ms.max(0.0) as u64,
            end_ms.max(begin_ms) as u64,
            &fallback_text,
        );
        return (segments, Vec::new());
    }

    let assembled = assemble_text_from_words(words_json);
    let text = if assembled.trim().is_empty() {
        fallback_text
    } else {
        assembled
    };
    if text.trim().is_empty() {
        return (Vec::new(), Vec::new());
    }

    let timed = funasr_file_words_to_timed(words_json, begin_ms);
    let timed_words_json = timed_words_to_json(&timed);

    let mut segments = Vec::new();
    push_speech_segment(
        &mut segments,
        begin_ms.max(0.0) as u64,
        end_ms.max(begin_ms) as u64,
        &text,
    );
    (segments, timed_words_json)
}

/// 解析 Fun-ASR 文件转写结果 JSON（`transcription_url` 下载体）。
pub fn parse_funasr_file_transcription(j: &Value) -> Result<FunasrFileTranscriptionParse, String> {
    let duration_sec = j
        .pointer("/properties/original_duration_in_milliseconds")
        .and_then(json_f64)
        .map(|ms| ms / 1000.0);
    let transcripts = j
        .get("transcripts")
        .and_then(|t| t.as_array())
        .ok_or_else(|| "百炼文件转写结果缺少 transcripts".to_string())?;

    let mut segments: Vec<Value> = Vec::new();
    let mut timed_words: Vec<Value> = Vec::new();

    for tr in transcripts {
        if let Some(sentences) = tr.get("sentences").and_then(|s| s.as_array()) {
            for sentence in sentences {
                let (mut sentence_segments, mut sentence_words) = segments_for_sentence(sentence);
                segments.append(&mut sentence_segments);
                timed_words.append(&mut sentence_words);
            }
        } else if let Some(text) = tr.get("text").and_then(|x| x.as_str()) {
            let text = text.trim();
            if !text.is_empty() {
                let end = duration_sec.unwrap_or(0.0);
                segments.push(json!({
                    "start_sec": 0.0_f64,
                    "end_sec": end,
                    "text": text,
                    "confidence": Value::Null,
                    "low_confidence": false,
                    "kind": "speech",
                }));
            }
        }
    }

    if segments.is_empty() {
        return Err("百炼文件转写未返回分句".to_string());
    }

    let mut all_timed = Vec::new();
    for tr in transcripts {
        if let Some(sentences) = tr.get("sentences").and_then(|s| s.as_array()) {
            for sentence in sentences {
                if let Some(words) = sentence.get("words").and_then(|w| w.as_array()) {
                    let begin = sentence.get("begin_time").and_then(json_f64).unwrap_or(0.0);
                    all_timed.extend(funasr_file_words_to_timed(words, begin));
                }
            }
        }
    }

    let refine_opts = OnlineSegmentNormalizeOptions::cjk_oral();
    segments = refine_long_speech_segments(segments, &all_timed, &refine_opts);

    let full_parts: Vec<String> = segments
        .iter()
        .filter_map(|s| s.get("text").and_then(|t| t.as_str()).map(str::to_string))
        .collect();
    let full_text = full_parts.join("");
    Ok((segments, full_text, duration_sec, timed_words))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_file_transcription_sentences() {
        let j: Value = serde_json::from_str(
            r#"{
            "properties": { "original_duration_in_milliseconds": 12000 },
            "transcripts": [{
                "channel_id": 0,
                "sentences": [
                    { "begin_time": 100, "end_time": 2500, "text": "第一句。", "words": [
                        { "begin_time": 100, "end_time": 500, "text": "第", "punctuation": "" },
                        { "begin_time": 500, "end_time": 2500, "text": "一句", "punctuation": "。" }
                    ]},
                    { "begin_time": 3000, "end_time": 5800, "text": "第二句。" }
                ]
            }]
        }"#,
        )
        .expect("json");
        let (segments, full_text, dur, words) = parse_funasr_file_transcription(&j).expect("parse");
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0]["text"], "第一句。");
        assert_eq!(segments[1]["text"], "第二句。");
        assert_eq!(full_text, "第一句。第二句。");
        assert_eq!(dur, Some(12.0));
        assert!(!words.is_empty());
    }

    #[test]
    fn prefers_word_punctuation_over_bare_sentence_text() {
        let j: Value = serde_json::from_str(
            r#"{
            "properties": { "original_duration_in_milliseconds": 5000 },
            "transcripts": [{
                "sentences": [{
                    "begin_time": 0,
                    "end_time": 2000,
                    "text": "你好世界",
                    "words": [
                        { "begin_time": 0, "end_time": 800, "text": "你好", "punctuation": "，" },
                        { "begin_time": 800, "end_time": 2000, "text": "世界", "punctuation": "。" }
                    ]
                }]
            }]
        }"#,
        )
        .expect("json");
        let (segments, _, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0]["text"], "你好，世界。");
    }

    #[test]
    fn refines_long_cloud_sentence_via_shared_normalize() {
        let j: Value = serde_json::from_str(
            r#"{
            "properties": { "original_duration_in_milliseconds": 40000 },
            "transcripts": [{
                "sentences": [{
                    "begin_time": 0,
                    "end_time": 32000,
                    "text": "甲很长乙也很长",
                    "words": [
                        { "begin_time": 0, "end_time": 500, "text": "甲", "punctuation": "，" },
                        { "begin_time": 500, "end_time": 1200, "text": "很长", "punctuation": "。" },
                        { "begin_time": 12000, "end_time": 12500, "text": "乙", "punctuation": "，" },
                        { "begin_time": 12500, "end_time": 13200, "text": "也很长", "punctuation": "。" }
                    ]
                }]
            }]
        }"#,
        )
        .expect("json");
        let (segments, full_text, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert!(
            segments.len() >= 2,
            "expected refine, got {}",
            segments.len()
        );
        assert_eq!(segments[0]["text"], "甲，很长。");
        assert_eq!(segments[1]["text"], "乙，也很长。");
        assert_eq!(full_text, "甲，很长。乙，也很长。");
    }

    #[test]
    fn keeps_short_cloud_sentence_as_single_segment() {
        let j: Value = serde_json::from_str(
            r#"{
            "transcripts": [{
                "sentences": [{
                    "begin_time": 1000,
                    "end_time": 3500,
                    "text": "短句。",
                    "words": [
                        { "begin_time": 1000, "end_time": 2000, "text": "短", "punctuation": "" },
                        { "begin_time": 2000, "end_time": 3500, "text": "句", "punctuation": "。" }
                    ]
                }]
            }]
        }"#,
        )
        .expect("json");
        let (segments, _, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0]["text"], "短句。");
    }

    #[test]
    fn refines_runon_oral_without_internal_punct() {
        let mut words_json = String::from("[");
        let word_count = 24;
        let total_ms = 32_600;
        for i in 0..word_count {
            if i > 0 {
                words_json.push(',');
            }
            let begin = i * total_ms / word_count;
            let end = (i + 1) * total_ms / word_count;
            let punct = if i + 1 == word_count { "。" } else { "" };
            words_json.push_str(&format!(
                r#"{{ "begin_time": {begin}, "end_time": {end}, "text": "词{i}", "punctuation": "{punct}" }}"#
            ));
        }
        words_json.push(']');
        let j: Value = serde_json::from_str(&format!(
            r#"{{
            "properties": {{ "original_duration_in_milliseconds": {total_ms} }},
            "transcripts": [{{
                "sentences": [{{
                    "begin_time": 0,
                    "end_time": {total_ms},
                    "text": "很长 oral",
                    "words": {words_json}
                }}]
            }}]
        }}"#
        ))
        .expect("json");
        let (segments, full_text, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert!(
            segments.len() >= 3,
            "expected forced refine, got {}",
            segments.len()
        );
        assert!(full_text.ends_with('。'));
    }
}

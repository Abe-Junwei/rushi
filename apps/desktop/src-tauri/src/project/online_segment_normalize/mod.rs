mod json_pipeline;
mod types;
mod vendor_words;
mod word_axis;

pub use json_pipeline::{
    normalize_online_transcribe_json, proportional_segments_from_text, refine_online_transcribe_segments,
};
pub use types::{OnlineSegmentNormalizeOptions, TimedWord};
pub use vendor_words::{
    assemblyai_words_to_segments, assemblyai_words_to_timed_words, deepgram_words_to_timed_words,
    funasr_file_words_to_timed, funasr_word_piece, openai_words_to_timed_words,
};
pub use word_axis::{
    long_span_needs_word_refinement, refine_long_speech_segments, timed_words_from_json_array,
    timed_words_to_json, timed_words_to_segments, words_overlapping_range,
};

#[cfg(test)]
mod tests {
    use super::*;
    use json_pipeline::segment_count_for_test as segment_count;
    use serde_json::json;

    fn ms_word(text: &str, start: u64, end: u64) -> TimedWord {
        TimedWord {
            text: text.to_string(),
            start_ms: start,
            end_ms: end,
        }
    }

    #[test]
    fn gap_splits_assemblyai_style() {
        let words = vec![
            ms_word("你好", 0, 400),
            ms_word("世界", 500, 900),
            ms_word("再见", 2000, 2400),
        ];
        let segs = timed_words_to_segments(&words, &OnlineSegmentNormalizeOptions::english_words());
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0]["text"], "你好 世界");
        assert_eq!(segs[1]["text"], "再见");
    }

    #[test]
    fn punctuation_break_when_enabled() {
        let words = vec![ms_word("第一句。", 0, 500), ms_word("第二句", 600, 1000)];
        let opts = OnlineSegmentNormalizeOptions {
            break_on_punctuation: true,
            ..OnlineSegmentNormalizeOptions::english_words()
        };
        let segs = timed_words_to_segments(&words, &opts);
        assert_eq!(segs.len(), 2);
    }

    #[test]
    fn cjk_oral_subsplits_on_gaps_and_commas() {
        let words = vec![
            ms_word("甲，", 0, 500),
            ms_word("很长。", 500, 1200),
            ms_word("乙，", 12_000, 12_500),
            ms_word("也很长。", 12_500, 13_200),
        ];
        let segs = timed_words_to_segments(&words, &OnlineSegmentNormalizeOptions::cjk_oral());
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0]["text"], "甲，很长。");
        assert_eq!(segs[1]["text"], "乙，也很长。");
    }

    #[test]
    fn cjk_oral_force_splits_runon_without_internal_punct() {
        let word_count = 24;
        let total_ms = 32_600u64;
        let mut words = Vec::new();
        for i in 0..word_count {
            let begin = i * total_ms / word_count;
            let end = (i + 1) * total_ms / word_count;
            let text = if i + 1 == word_count {
                format!("词{i}。")
            } else {
                format!("词{i}")
            };
            words.push(ms_word(&text, begin, end));
        }
        let segs = timed_words_to_segments(&words, &OnlineSegmentNormalizeOptions::cjk_oral());
        assert!(segs.len() >= 3, "expected forced split, got {}", segs.len());
        for (i, seg) in segs.iter().enumerate().take(segs.len() - 1) {
            let text = seg["text"].as_str().unwrap_or("");
            assert!(
                text.ends_with('，') || text.ends_with('。'),
                "segment {i} should end with clause punct: {text}"
            );
        }
    }

    #[test]
    fn refine_long_segments_replaces_only_long_spans() {
        let timed = vec![
            ms_word("甲，", 0, 500),
            ms_word("很长。", 500, 1200),
            ms_word("乙，", 12_000, 12_500),
            ms_word("也很长。", 12_500, 13_200),
        ];
        let segments = vec![json!({
            "start_sec": 0.0,
            "end_sec": 32.0,
            "text": "甲，很长。乙，也很长。",
            "kind": "speech",
        })];
        let refined = refine_long_speech_segments(
            segments,
            &timed,
            &OnlineSegmentNormalizeOptions::cjk_oral(),
        );
        assert_eq!(refined.len(), 2);
    }

    #[test]
    fn assemblyai_words_golden_gap() {
        let words = vec![
            json!({"text": "hello", "start": 0.0, "end": 400.0}),
            json!({"text": "world", "start": 500.0, "end": 900.0}),
            json!({"text": "bye", "start": 2000.0, "end": 2400.0}),
        ];
        let segs = assemblyai_words_to_segments(&words);
        assert_eq!(segs.len(), 2);
        assert!((segs[0]["start_sec"].as_f64().unwrap() - 0.0).abs() < 0.001);
        assert!((segs[1]["start_sec"].as_f64().unwrap() - 2.0).abs() < 0.001);
    }

    #[test]
    fn proportional_splits_chinese() {
        let text = "第一句。第二句。第三句。";
        let segs = proportional_segments_from_text(text, 0.0, 30.0);
        assert_eq!(segs.len(), 3);
        assert!(segs[0]["kind"] == "placeholder");
        assert!((segs[2]["end_sec"].as_f64().unwrap() - 30.0).abs() < 0.001);
    }

    #[test]
    fn proportional_respects_segment_span() {
        let text = "甲。乙。";
        let segs = proportional_segments_from_text(text, 10.0, 25.0);
        assert_eq!(segs.len(), 2);
        assert!((segs[0]["start_sec"].as_f64().unwrap() - 10.0).abs() < 0.001);
        assert!((segs[1]["end_sec"].as_f64().unwrap() - 25.0).abs() < 0.001);
    }

    #[test]
    fn normalize_applies_tier_c_when_single_segment() {
        let mut v = json!({
            "full_text": "甲。乙。丙。",
            "segments": [{"start_sec": 0.0, "end_sec": 9.0, "text": "甲。乙。丙。", "kind": "placeholder"}],
            "duration_sec": 9.0
        });
        let extra = normalize_online_transcribe_json(
            &mut v,
            Some(9.0),
            &OnlineSegmentNormalizeOptions::default(),
        );
        assert!(extra.iter().any(|w| w == "online_segmentation_proportional"));
        assert!(segment_count(&v) >= 2);
    }

    #[test]
    fn normalize_skips_tier_c_for_single_speech_segment() {
        let mut v = json!({
            "full_text": "甲。乙。丙。",
            "segments": [{
                "start_sec": 0.0,
                "end_sec": 9.0,
                "text": "甲。乙。丙。",
                "kind": "speech"
            }],
            "duration_sec": 9.0
        });
        let extra = normalize_online_transcribe_json(
            &mut v,
            Some(9.0),
            &OnlineSegmentNormalizeOptions::default(),
        );
        assert!(extra.is_empty());
        assert_eq!(segment_count(&v), 1);
    }

    #[test]
    fn normalize_skips_when_already_multi_segment() {
        let mut v = json!({
            "full_text": "a b",
            "segments": [
                {"start_sec": 0.0, "end_sec": 1.0, "text": "a"},
                {"start_sec": 1.0, "end_sec": 2.0, "text": "b"}
            ]
        });
        let extra = normalize_online_transcribe_json(
            &mut v,
            Some(2.0),
            &OnlineSegmentNormalizeOptions::default(),
        );
        assert!(extra.is_empty());
        assert_eq!(segment_count(&v), 2);
    }
}

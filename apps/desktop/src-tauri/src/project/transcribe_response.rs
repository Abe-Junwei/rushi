//! Parse `/v1/transcribe` JSON segments into `SegmentDto` (R3t-B).

use super::types::SegmentDto;
use serde_json::Value;

pub fn parse_transcribe_segments_from_json(arr: &[Value]) -> Result<Vec<SegmentDto>, String> {
    let mut segments: Vec<SegmentDto> = Vec::new();
    for (i, row) in arr.iter().enumerate() {
        let start = row
            .get("start_sec")
            .and_then(|x| x.as_f64())
            .ok_or_else(|| format!("segment {i} start_sec"))?;
        let end = row
            .get("end_sec")
            .and_then(|x| x.as_f64())
            .ok_or_else(|| format!("segment {i} end_sec"))?;
        let text = row
            .get("text")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let confidence = row.get("confidence").and_then(|x| x.as_f64());
        let low_confidence = row
            .get("low_confidence")
            .and_then(|x| x.as_bool())
            .unwrap_or(false);
        let detail = row
            .get("detail")
            .and_then(|x| x.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from);
        let kind = row
            .get("kind")
            .and_then(|x| x.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from)
            .or_else(|| {
                if detail.as_deref() == Some("funasr_whole_track_fallback") {
                    Some("placeholder".to_string())
                } else {
                    Some("speech".to_string())
                }
            });
        segments.push(SegmentDto {
            uid: Some(uuid::Uuid::new_v4().to_string()),
            idx: i as i32,
            start_sec: start,
            end_sec: end,
            text,
            confidence,
            low_confidence,
            detail,
            kind,
        });
    }
    Ok(segments)
}

pub fn merge_transcribe_warnings(
    mut warnings: Vec<String>,
    vocabulary_pre: Vec<String>,
    hotwords_truncated: bool,
    long_audio_hint: Option<&str>,
    segmentation_mode: Option<&str>,
) -> Vec<String> {
    if let Some(mode) = segmentation_mode.filter(|s| !s.is_empty()) {
        let tag = format!("segmentation_mode:{mode}");
        if !warnings.iter().any(|w| w.starts_with("segmentation_mode:")) {
            warnings.push(tag);
        }
    }
    if !vocabulary_pre.is_empty() {
        let mut seen: std::collections::HashSet<String> = warnings.iter().cloned().collect();
        for w in vocabulary_pre {
            if seen.insert(w.clone()) {
                warnings.push(w);
            }
        }
    }
    if hotwords_truncated && !warnings.iter().any(|w| w == "hotwords_truncated_12k") {
        warnings.insert(0, "hotwords_truncated_12k".to_string());
    }
    if let Some(hint) = long_audio_hint.filter(|s| !s.is_empty()) {
        warnings.insert(0, hint.to_string());
    }
    warnings
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_empty_segments_array() {
        let segs = parse_transcribe_segments_from_json(&[]).unwrap();
        assert!(segs.is_empty());
    }

    #[test]
    fn parse_segment_row_and_placeholder_kind() {
        let arr = vec![json!({
            "start_sec": 0.0,
            "end_sec": 12.0,
            "text": "短音频",
            "detail": "funasr_whole_track_fallback",
        })];
        let segs = parse_transcribe_segments_from_json(&arr).unwrap();
        assert_eq!(segs.len(), 1);
        assert_eq!(segs[0].kind.as_deref(), Some("placeholder"));
        assert_eq!(segs[0].text, "短音频");
    }

    #[test]
    fn merge_warnings_adds_segmentation_mode_once() {
        let w = merge_transcribe_warnings(vec![], vec![], false, None, Some("sentence_info"));
        assert!(w.iter().any(|x| x == "segmentation_mode:sentence_info"));
    }
}

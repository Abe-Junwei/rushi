//! Plain-text / SRT import parsers for project creation.

use super::types::SegmentDto;

/// Parse SRT timestamp "HH:MM:SS,mmm" to seconds.
pub fn parse_srt_time(s: &str) -> Option<f64> {
    let s = s.trim();
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let sec_ms = parts[2];
    let sec_parts: Vec<&str> = sec_ms.split(',').collect();
    if sec_parts.len() != 2 {
        return None;
    }
    let sec: f64 = sec_parts[0].parse().ok()?;
    let ms: f64 = sec_parts[1].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + sec + ms / 1000.0)
}

pub fn parse_srt(content: &str) -> Result<Vec<SegmentDto>, String> {
    let mut segments = Vec::new();
    let blocks: Vec<&str> = content.split("\n\n").collect();
    for block in blocks {
        let lines: Vec<&str> = block.lines().collect();
        if lines.len() < 3 {
            continue;
        }
        let time_line = lines[1];
        let time_parts: Vec<&str> = time_line.split(" --> ").collect();
        if time_parts.len() != 2 {
            continue;
        }
        let start_sec = parse_srt_time(time_parts[0]).ok_or("SRT 时间戳格式错误")?;
        let end_sec = parse_srt_time(time_parts[1]).ok_or("SRT 时间戳格式错误")?;
        let text = lines[2..].join("\n");
        segments.push(SegmentDto {
            uid: Some(uuid::Uuid::new_v4().to_string()),
            idx: segments.len() as i32,
            start_sec,
            end_sec,
            text,
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
        });
    }
    Ok(segments)
}

/// Estimate timestamps for plain text paragraphs (~250 CJK chars/min).
const CHARS_PER_SEC: f64 = 250.0 / 60.0;

pub fn parse_txt(content: &str) -> Vec<SegmentDto> {
    let mut segments = Vec::new();
    let paragraphs: Vec<&str> = content.split("\n\n").collect();
    let mut current_sec = 0.0;
    for para in paragraphs {
        let text = para.trim().replace('\n', " ");
        if text.is_empty() {
            continue;
        }
        let char_count = text.chars().count() as f64;
        let duration = char_count / CHARS_PER_SEC;
        let start_sec = current_sec;
        let end_sec = current_sec + duration.max(1.0);
        segments.push(SegmentDto {
            uid: Some(uuid::Uuid::new_v4().to_string()),
            idx: segments.len() as i32,
            start_sec,
            end_sec,
            text,
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
        });
        current_sec = end_sec;
    }
    segments
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_txt_empty_returns_empty() {
        assert!(parse_txt("").is_empty());
    }

    #[test]
    fn parse_txt_single_paragraph() {
        let segs = parse_txt("你好世界");
        assert_eq!(segs.len(), 1);
        assert_eq!(segs[0].text, "你好世界");
        assert_eq!(segs[0].idx, 0);
        assert_eq!(segs[0].start_sec, 0.0);
        assert!(segs[0].end_sec > 0.0);
    }

    #[test]
    fn parse_txt_multiple_paragraphs() {
        let segs = parse_txt("第一段\n\n第二段");
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[1].start_sec, segs[0].end_sec);
    }

    #[test]
    fn parse_srt_basic() {
        let srt = "1\n00:00:01,000 --> 00:00:03,500\nHello world\n\n2\n00:00:04,000 --> 00:00:06,000\n第二句";
        let segs = parse_srt(srt).unwrap();
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0].start_sec, 1.0);
        assert_eq!(segs[1].text, "第二句");
    }
}

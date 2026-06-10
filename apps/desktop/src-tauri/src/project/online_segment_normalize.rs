//! 在线 STT 统一分段：Tier A 厂商句界 → Tier B 词轴 gap/标点/硬上限精炼 → Tier C 比例兜底。
//!
//! 业内通用模式（AssemblyAI / Deepgram / Rev 等）：词级时间戳 + 静音 gap 切句；
//! 中文口述（百炼 Fun-ASR）额外启用弱标点、子句时长/字数硬上限与 forced-break 逗号。

use serde_json::json;

/// 毫秒，与 AssemblyAI words 及百炼 `begin_time`/`end_time` 一致。
#[derive(Debug, Clone, PartialEq)]
pub struct TimedWord {
    pub text: String,
    pub start_ms: u64,
    pub end_ms: u64,
}

/// Tier B 词轴切句选项；按语言/厂商选用 preset（`english_words` / `cjk_oral`）。
#[derive(Debug, Clone)]
pub struct OnlineSegmentNormalizeOptions {
    pub gap_ms: u64,
    /// 句末标点（。！？；等）处断句
    pub break_on_punctuation: bool,
    /// 逗号/顿号处断句（须同时满足子句最短时长或字数）
    pub break_on_weak_punctuation: bool,
    pub weak_punct_min_duration_ms: u64,
    pub weak_punct_min_chars: usize,
    /// 子句硬上限：超过则在下一词边界强制切分
    pub max_segment_sec: Option<f64>,
    pub max_segment_chars: Option<usize>,
    /// 强制切分时若子句无句读，补 `，` 便于阅读
    pub inject_comma_on_forced_break: bool,
    /// 英文词间加空格；中文 CJK 为 false
    pub join_with_space: bool,
    /// 仅当 span 超过此阈值时才对 Tier A 语段做 Tier B 再切
    pub refine_span_min_sec: Option<f64>,
    pub refine_span_min_chars: Option<usize>,
    pub allow_tier_c_fallback: bool,
}

impl OnlineSegmentNormalizeOptions {
    /// AssemblyAI / Deepgram / OpenAI words：gap 切句 + 英文空格拼接。
    pub fn english_words() -> Self {
        Self {
            gap_ms: 850,
            break_on_punctuation: false,
            break_on_weak_punctuation: false,
            weak_punct_min_duration_ms: 0,
            weak_punct_min_chars: 0,
            max_segment_sec: None,
            max_segment_chars: None,
            inject_comma_on_forced_break: false,
            join_with_space: true,
            refine_span_min_sec: None,
            refine_span_min_chars: None,
            allow_tier_c_fallback: true,
        }
    }

    /// 百炼 Fun-ASR 中文口述：gap + 强/弱标点 + 子句硬上限 + 长 span 精炼。
    pub fn cjk_oral() -> Self {
        Self {
            gap_ms: 850,
            break_on_punctuation: true,
            break_on_weak_punctuation: true,
            weak_punct_min_duration_ms: 4_000,
            weak_punct_min_chars: 40,
            max_segment_sec: Some(10.0),
            max_segment_chars: Some(55),
            inject_comma_on_forced_break: true,
            join_with_space: false,
            refine_span_min_sec: Some(10.0),
            refine_span_min_chars: Some(80),
            allow_tier_c_fallback: true,
        }
    }

    pub fn refine_opts_for_engine(engine: &str) -> Self {
        if engine.starts_with("dashscope:") {
            Self::cjk_oral()
        } else {
            Self::english_words()
        }
    }
}

impl Default for OnlineSegmentNormalizeOptions {
    fn default() -> Self {
        Self::english_words()
    }
}

const TERMINAL_PUNCT: [char; 7] = ['.', '?', '!', '。', '！', '？', '；'];
const WEAK_PUNCT: [char; 2] = ['，', '、'];
const PUNCT_BREAK: [char; 7] = TERMINAL_PUNCT;

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
    if opts
        .max_segment_sec
        .is_some_and(|max| dur_sec > max)
    {
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

/// Tier A 语段列表 + 全局词轴：对超长 span 做 Tier B 再切（百炼等）。
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

/// 百炼 Fun-ASR 文件转写：`text` + `punctuation` 拼成词片。
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

fn json_f64(v: &serde_json::Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_i64().map(|n| n as f64))
        .or_else(|| v.as_u64().map(|n| n as f64))
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
        let start_ms = (w.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0) * 1000.0)
            .max(0.0) as u64;
        let end_ms = (w
            .get("end")
            .and_then(|x| x.as_f64())
            .unwrap_or(start_ms as f64 / 1000.0)
            * 1000.0)
            .max(start_ms as f64) as u64;
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
        let piece = w
            .get("word")
            .and_then(|x| x.as_str())
            .or_else(|| w.get("text").and_then(|x| x.as_str()))
            .unwrap_or("")
            .trim();
        if piece.is_empty() {
            continue;
        }
        let start_ms = (w.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0) * 1000.0)
            .max(0.0) as u64;
        let end_ms = (w
            .get("end")
            .and_then(|x| x.as_f64())
            .unwrap_or(start_ms as f64 / 1000.0)
            * 1000.0)
            .max(start_ms as f64) as u64;
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

/// 在线 JSON 含 `timed_words` 时对 Tier A 超长语段做 Tier B 精炼。
pub fn refine_online_transcribe_segments(
    v: &mut serde_json::Value,
    engine: &str,
) -> Option<usize> {
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

/// Tier C：按标点切句 + 字符比例分配时长（估算，非声学真源）。
/// `range_start`/`range_end` 为比例切分的时间窗口（通常为占位语段 span）。
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
        if span > 0.0 && span.is_finite() {
            if probe_end <= 0.0 || (end <= probe_end + 1.0 && span <= probe_end + 1.0) {
                return (start, end);
            }
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

/// 单段且已标 `kind: speech` 时视为 Tier A，不得再跑 Tier C 比例切分。
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

/// 在线转写 JSON 统一 normalize（仅在线路径调用）。
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

#[cfg(test)]
mod tests {
    use super::*;

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
        let words = vec![
            ms_word("第一句。", 0, 500),
            ms_word("第二句", 600, 1000),
        ];
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
        let refined =
            refine_long_speech_segments(segments, &timed, &OnlineSegmentNormalizeOptions::cjk_oral());
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
        let extra = normalize_online_transcribe_json(&mut v, Some(9.0), &OnlineSegmentNormalizeOptions::default());
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
        let extra = normalize_online_transcribe_json(&mut v, Some(9.0), &OnlineSegmentNormalizeOptions::default());
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
        let extra = normalize_online_transcribe_json(&mut v, Some(2.0), &OnlineSegmentNormalizeOptions::default());
        assert!(extra.is_empty());
        assert_eq!(segment_count(&v), 2);
    }
}

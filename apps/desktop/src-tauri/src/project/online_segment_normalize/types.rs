//! 在线 STT 统一分段：Tier A 厂商句界 → Tier B 词轴 gap/标点/硬上限精炼 → Tier C 比例兜底。

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
    pub break_on_punctuation: bool,
    pub break_on_weak_punctuation: bool,
    pub weak_punct_min_duration_ms: u64,
    pub weak_punct_min_chars: usize,
    pub max_segment_sec: Option<f64>,
    pub max_segment_chars: Option<usize>,
    pub inject_comma_on_forced_break: bool,
    pub join_with_space: bool,
    pub refine_span_min_sec: Option<f64>,
    pub refine_span_min_chars: Option<usize>,
    pub allow_tier_c_fallback: bool,
}

impl OnlineSegmentNormalizeOptions {
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

pub(crate) const TERMINAL_PUNCT: [char; 7] = ['.', '?', '!', '。', '！', '？', '；'];
pub(crate) const WEAK_PUNCT: [char; 2] = ['，', '、'];
pub(crate) const PUNCT_BREAK: [char; 7] = TERMINAL_PUNCT;

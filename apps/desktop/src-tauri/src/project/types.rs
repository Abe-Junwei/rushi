use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct RunTranscribeOutcome {
    pub detail: FileDetail,
    pub engine: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub file_count: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct ProjectDetail {
    pub id: String,
    pub name: String,
    pub files: Vec<FileSummary>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct FileSummary {
    pub id: String,
    pub name: String,
    pub file_type: String,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct FileDetail {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub file_type: String,
    pub audio_path: Option<String>,
    pub segments: Vec<SegmentDto>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct EditLogEntryDto {
    pub id: i64,
    pub project_id: String,
    pub at_ms: i64,
    pub kind: String,
    pub detail: String,
    pub has_snapshot: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformPeakLevelStatus {
    pub level: u8,
    pub pixels_per_second: u32,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformPeaksStatus {
    pub levels: Vec<WaveformPeakLevelStatus>,
    pub sample_rate: Option<u32>,
    pub duration_sec: Option<f64>,
    /// True while a background `.generating.lock` is held for this file.
    pub generating: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentDto {
    /// 稳定语段 id（波形 region、按 uid upsert 落库）；旧数据可为空，加载/保存时补全。
    #[serde(default)]
    pub uid: Option<String>,
    pub idx: i32,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
    #[serde(default)]
    pub confidence: Option<f64>,
    #[serde(default)]
    pub low_confidence: bool,
    #[serde(default)]
    pub detail: Option<String>,
    /// 显式语段类型："placeholder"=整轨占位（波形不渲染），"speech"=正常语段；
    /// 旧数据 / 未标记为 None，按 0.85 跨度启发式回退判定。
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default = "default_segment_text_stage")]
    pub text_stage: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finalize_via: Option<String>,
}

fn default_segment_text_stage() -> String {
    "auto_transcribe".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryTermDto {
    pub id: i64,
    pub term: String,
    #[serde(default)]
    pub aliases: String,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub note: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    #[serde(default = "default_glossary_hotword_enabled")]
    pub hotword_enabled: bool,
}

fn default_glossary_hotword_enabled() -> bool {
    true
}

/// File type classification persisted in the database.
#[allow(dead_code)]
pub mod file_type {
    pub const TEXT: &str = "text";
    pub const PAIRED: &str = "paired";
    pub const AUDIO_ONLY: &str = "audio_only";

    pub fn is_valid(t: &str) -> bool {
        matches!(t, TEXT | PAIRED | AUDIO_ONLY)
    }
}

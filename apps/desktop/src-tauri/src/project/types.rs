use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct RunTranscribeOutcome {
    pub detail: FileDetail,
    pub engine: String,
    pub warnings: Vec<String>,
}

pub static HTTP_CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentDto {
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
}

#[derive(Debug, Serialize)]
pub struct GlossaryTermDto {
    pub id: i64,
    pub term: String,
    pub created_at_ms: i64,
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

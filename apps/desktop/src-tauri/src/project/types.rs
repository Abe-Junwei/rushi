use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct RunTranscribeOutcome {
    pub detail: ProjectDetail,
    pub engine: String,
    pub warnings: Vec<String>,
}

pub static HTTP_CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();

#[derive(Debug, Serialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct ProjectDetail {
    pub id: String,
    pub name: String,
    pub audio_storage_path: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub segments: Vec<SegmentDto>,
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

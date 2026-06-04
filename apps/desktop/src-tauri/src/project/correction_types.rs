#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionExplicitPairDto {
    pub before_text: String,
    pub after_text: String,
}

/// Tauri IPC：前端仍传 learn baseline；保存路径已不再消费 diff 推断。
#[allow(dead_code)]
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionLearnBaselineTextDto {
    pub uid: String,
    pub text: String,
}

#[derive(Debug, Clone, Default)]
pub struct SaveSegmentsLearnOpts {
    pub explicit_pairs: Vec<(String, String)>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionRuleRow {
    pub wrong: String,
    pub right: String,
    pub hit_count: i32,
    pub accepted_as_rule: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryLearnPromptRow {
    pub after_text: String,
    pub hit_count: i32,
    pub sample_before: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionMemoryEntryRow {
    pub wrong: String,
    pub right: String,
    pub hit_count: i32,
    pub accepted_as_rule: bool,
    pub updated_at_ms: i64,
    pub is_stable: bool,
}

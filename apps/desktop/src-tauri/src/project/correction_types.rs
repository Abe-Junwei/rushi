#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionExplicitPairDto {
    pub before_text: String,
    pub after_text: String,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionLearnBaselineTextDto {
    pub uid: String,
    pub text: String,
}

/// 稳定规则 / 自动进术语表：同一错→对累计命中次数阈值（含纳入记忆与保存推断）。
pub const CORRECTION_MEMORY_STABLE_HIT: i32 = 3;

#[derive(Debug, Clone, Default)]
pub struct SaveSegmentsLearnOpts {
    pub explicit_pairs: Vec<(String, String)>,
    pub count_hits: bool,
    /// uid → 保存前正文；空时 save 路径回退 DB 快照。
    pub learn_baseline: Vec<(String, String)>,
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

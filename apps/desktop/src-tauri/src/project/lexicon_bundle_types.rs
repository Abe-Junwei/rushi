use serde::{Deserialize, Serialize};

pub(crate) const BUNDLE_KIND: &str = "rushi_lexicon_bundle";
pub(crate) const BUNDLE_VERSION: i32 = 1;

pub(crate) const FORBIDDEN_TOP_LEVEL_KEYS: &[&str] = &[
    "segments",
    "segment",
    "api_key",
    "apiKey",
    "project_id",
    "file_id",
    "uids",
    "password",
    "secret",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleExportedBy {
    pub app: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optional_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexiconBundleGlossaryTerm {
    pub term: String,
    #[serde(default)]
    pub aliases: String,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub note: String,
    #[serde(default = "default_hotword_enabled")]
    pub hotword_enabled: bool,
}

fn default_hotword_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexiconBundleCorrectionRule {
    pub before_text: String,
    pub after_text: String,
    pub hit_count: i32,
    pub accepted_as_rule: bool,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexiconBundleDocument {
    pub kind: String,
    pub version: i32,
    pub exported_at_ms: i64,
    pub exported_by: LexiconBundleExportedBy,
    #[serde(default)]
    pub glossary_terms: Vec<LexiconBundleGlossaryTerm>,
    #[serde(default)]
    pub correction_rules: Vec<LexiconBundleCorrectionRule>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleExportPreview {
    pub glossary_count: usize,
    pub rules_export_count: usize,
    pub rules_all_deduped_count: usize,
    pub excluded_hit1_unaccepted: usize,
    pub excluded_learning_unaccepted: usize,
    pub duplicate_before_group_count: usize,
    pub duplicate_before_samples: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleImportPreview {
    pub insert_glossary: usize,
    pub skip_glossary: usize,
    pub insert_rules: usize,
    pub skip_rules: usize,
    pub auto_resolved_rules: usize,
    pub conflicts: Vec<LexiconBundleConflict>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleConflict {
    pub id: String,
    pub kind: String,
    pub before_text: Option<String>,
    pub local_after_text: Option<String>,
    pub bundle_after_text: Option<String>,
    pub term: Option<String>,
    pub local_aliases: Option<String>,
    pub bundle_aliases: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleConflictResolution {
    pub id: String,
    pub choice: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleImportApplyResult {
    pub inserted_glossary: usize,
    pub skipped_glossary: usize,
    pub inserted_rules: usize,
    pub merged_rules: usize,
    pub replaced_rules: usize,
}

#[derive(Debug, Clone)]
pub(crate) struct LocalGlossaryRow {
    pub(crate) term: String,
    pub(crate) aliases: String,
    pub(crate) domain: String,
    pub(crate) note: String,
    pub(crate) hotword_enabled: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct LocalRuleRow {
    pub(crate) before_text: String,
    pub(crate) after_text: String,
    pub(crate) hit_count: i32,
    pub(crate) accepted_as_rule: bool,
    pub(crate) updated_at_ms: i64,
}

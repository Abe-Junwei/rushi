use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDuplicateFileMatch {
    pub file_id: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDuplicateCheck {
    pub by_source_path: Vec<ImportDuplicateFileMatch>,
    pub by_content_hash: Vec<ImportDuplicateFileMatch>,
}

#[derive(Debug, Clone)]
pub struct ImportProvenance {
    pub source_path: String,
    pub content_sha256: String,
    pub source_size: i64,
    pub source_modified_ms: i64,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct SourceFileMeta {
    pub size: i64,
    pub modified_ms: i64,
}

#[derive(Debug, Clone)]
pub(crate) struct IncomingImportCheck {
    pub bytes_hash: String,
    pub meta: SourceFileMeta,
    pub text_segment_fingerprint: Option<String>,
}

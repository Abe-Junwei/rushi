use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LexiconEvidence {
    #[serde(rename = "type")]
    pub evidence_type: String,
    pub r#ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LexiconProofreadOp {
    pub op: String,
    pub uid: String,
    pub text: String,
    pub evidence: LexiconEvidence,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LexiconProofreadLlmPayload {
    #[serde(default)]
    pub ops: Vec<LexiconProofreadOp>,
    #[serde(default)]
    pub rationale: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LexiconProofreadParseResult {
    pub payload: LexiconProofreadLlmPayload,
    pub skipped_malformed_ops: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroundedLexiconOp {
    pub uid: String,
    pub text: String,
    pub evidence: LexiconEvidence,
}

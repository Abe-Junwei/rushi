use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

/// 桌面 UI 传入的运行时配置（DeepSeek / Kimi 等）；优先于进程环境变量。
/// JSON 字段与前端 `PostprocessRuntimeBridge` 一致（camelCase；兼容 snake_case alias）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessRuntimeBridge {
    pub provider: String,
    #[serde(alias = "base_url")]
    pub base_url: String,
    pub model: String,
    #[serde(default, alias = "api_key")]
    pub api_key: String,
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
    #[serde(default, alias = "allow_insecure_http")]
    pub allow_insecure_http: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NeighborContextItem {
    pub role: String,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PostprocessAutoPunctuateRequest {
    pub task: String,
    #[serde(default)]
    pub request_id: Option<String>,
    pub segment_uid: String,
    pub text: String,
    #[serde(default)]
    pub neighbor_snippets: Vec<String>,
    #[serde(default)]
    pub neighbor_context: Vec<NeighborContextItem>,
    #[serde(default)]
    pub runtime: Option<PostprocessRuntimeBridge>,
}

#[derive(Debug, Serialize)]
pub struct PostprocessAutoPunctuateRawResponse {
    pub text: String,
    pub provider: String,
    pub latency_ms: u64,
}

#[derive(Default)]
pub struct PostprocessCancelState(pub Mutex<HashMap<String, futures_util::future::AbortHandle>>);

#[derive(Debug, Deserialize)]
pub struct PostprocessCancelAutoPunctuateRequest {
    pub request_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessRefineSegmentsRequest {
    pub task: String,
    #[serde(default)]
    pub request_id: Option<String>,
    pub segments: Vec<super::postprocess_segment_ops::RefineSegmentItem>,
    #[serde(default)]
    pub runtime: Option<PostprocessRuntimeBridge>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessRefineSegmentsResponse {
    pub ops: Vec<super::postprocess_segment_ops::SegmentRefineOp>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    pub provider: String,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessStageBProofreadRequest {
    pub task: String,
    #[serde(default)]
    pub request_id: Option<String>,
    pub segments: Vec<super::postprocess_segment_ops::RefineSegmentItem>,
    #[serde(default)]
    pub runtime: Option<PostprocessRuntimeBridge>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessStageBProofreadResponse {
    pub ops: Vec<super::postprocess_segment_ops::SegmentRefineOp>,
    pub items: Vec<super::postprocess_lexicon_ops::GroundedLexiconOp>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub dropped_ops: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pack_meta: Option<crate::project::lexicon_pack::LexiconPackMeta>,
    pub provider: String,
    pub latency_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct LlmProbeConnectionResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    /// `chat_completion_ping` | `models_list`
    #[serde(skip_serializing_if = "Option::is_none", rename = "probeMethod")]
    pub probe_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
}

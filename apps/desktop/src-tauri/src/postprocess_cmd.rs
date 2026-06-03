#[path = "postprocess_lexicon_ops.rs"]
mod postprocess_lexicon_ops;
#[path = "postprocess_probe.rs"]
mod postprocess_probe;
#[path = "postprocess_secret_store.rs"]
mod postprocess_secret_store;
#[path = "postprocess_segment_ops.rs"]
mod postprocess_segment_ops;
#[path = "postprocess_export_polish.rs"]
mod postprocess_export_polish;
#[path = "postprocess_export_polish_cmd.rs"]
pub mod postprocess_export_polish_cmd;

pub use postprocess_export_polish_cmd::{
    PostprocessExportPolishRequest, PostprocessExportPolishResponse,
};


use crate::project::lexicon_pack::{
    assemble_lexicon_pack, lexicon_pack_is_usable, LexiconPackMeta,
};
use crate::project::utils::open_db;

use crate::project::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use postprocess_secret_store::{
    delete_llm_secret, llm_secret_exists, read_llm_secret, write_llm_secret,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;
use tauri::State;
use url::Url;

const DEFAULT_PROVIDER: &str = "openai-compatible";
const DEFAULT_TIMEOUT_SECS: u64 = 30;
const DEFAULT_API_KEY_ID: &str = "default";

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
pub struct PostprocessCancelState(pub Mutex<HashMap<String, AbortHandle>>);

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
    pub segments: Vec<postprocess_segment_ops::RefineSegmentItem>,
    #[serde(default)]
    pub runtime: Option<PostprocessRuntimeBridge>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessRefineSegmentsResponse {
    pub ops: Vec<postprocess_segment_ops::SegmentRefineOp>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    pub provider: String,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessLexiconProofreadRequest {
    pub task: String,
    #[serde(default)]
    pub request_id: Option<String>,
    pub segments: Vec<postprocess_segment_ops::RefineSegmentItem>,
    #[serde(default)]
    pub runtime: Option<PostprocessRuntimeBridge>,
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostprocessLexiconProofreadResponse {
    pub ops: Vec<postprocess_segment_ops::SegmentRefineOp>,
    pub items: Vec<postprocess_lexicon_ops::GroundedLexiconOp>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pack_meta: Option<LexiconPackMeta>,
    pub provider: String,
    pub latency_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSaveApiKeyRequest {
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
    #[serde(alias = "api_key")]
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmDeleteApiKeyRequest {
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LlmProbeConnectionRequest {
    pub runtime: PostprocessRuntimeBridge,
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

#[derive(Debug)]
pub(crate) struct PostprocessConfig {
    pub provider: String,
    pub endpoint: Url,
    pub model: String,
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmHasStoredApiKeyRequest {
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmMigrateLegacyApiKeyRequest {
    #[serde(alias = "legacy_api_key_id")]
    pub legacy_api_key_id: String,
}

#[tauri::command]
pub fn llm_has_stored_api_key(
    state: State<'_, DbState>,
    req: LlmHasStoredApiKeyRequest,
) -> Result<bool, String> {
    let api_key_id = normalize_api_key_id(req.api_key_id.as_deref());
    llm_secret_exists(&state.root, &api_key_id)
}

#[tauri::command]
pub fn llm_save_api_key(
    state: State<'_, DbState>,
    req: LlmSaveApiKeyRequest,
) -> Result<String, String> {
    let api_key = req.api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 为空，无法保存。".to_string());
    }
    let api_key_id = normalize_api_key_id(req.api_key_id.as_deref());
    write_llm_secret(&state.root, &api_key_id, api_key)?;
    Ok(api_key_id)
}

pub(crate) fn secret_account_for_delete(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|x| !x.is_empty())
        .unwrap_or(DEFAULT_API_KEY_ID)
        .to_string()
}

#[tauri::command]
pub fn llm_delete_api_key(
    state: State<'_, DbState>,
    req: LlmDeleteApiKeyRequest,
) -> Result<(), String> {
    // 删除必须按字面账户名，不能把 sk-… 规范化成 default（否则会误删刚保存的密钥）。
    let api_key_id = secret_account_for_delete(req.api_key_id.as_deref());
    delete_llm_secret(&state.root, &api_key_id)
}

/// 将旧版误写入账户名（如 sk- 明文）下的密钥迁移到 `default`（仅本地文件存储）。
#[tauri::command]
pub fn llm_migrate_legacy_api_key(
    state: State<'_, DbState>,
    req: LlmMigrateLegacyApiKeyRequest,
) -> Result<bool, String> {
    let legacy = req.legacy_api_key_id.trim();
    if legacy.is_empty() || is_valid_secret_account_id(legacy) {
        return Ok(false);
    }
    let Some(key) = read_llm_secret(&state.root, legacy)? else {
        return Ok(false);
    };
    write_llm_secret(&state.root, DEFAULT_API_KEY_ID, &key)?;
    let _ = delete_llm_secret(&state.root, legacy);
    Ok(true)
}

#[tauri::command]
pub fn llm_probe_connection(
    state: State<'_, DbState>,
    req: LlmProbeConnectionRequest,
) -> Result<LlmProbeConnectionResponse, String> {
    append_desktop_log_line(
        &state,
        &format!(
            "INFO llm_probe_start provider={} base_url={}",
            req.runtime.provider, req.runtime.base_url
        ),
    );
    let config = resolve_runtime_postprocess_config(&req.runtime, &state.root)?;
    append_desktop_log_line(
        &state,
        &format!("INFO llm_probe endpoint={}", config.endpoint),
    );
    let out =
        postprocess_probe::probe_llm_connection_blocking(&config, postprocess_probe::PROBE_TIMEOUT);
    let level = if out.ok { "INFO" } else { "WARN" };
    let status = out
        .status
        .map(|x| x.to_string())
        .unwrap_or_else(|| "-".to_string());
    let latency_ms = out
        .latency_ms
        .map(|x| x.to_string())
        .unwrap_or_else(|| "-".to_string());
    append_desktop_log_line(
        &state,
        &format!(
            "{level} llm_probe_done status={} latency_ms={} method={} message={}",
            status,
            latency_ms,
            out.probe_method.as_deref().unwrap_or("-"),
            crate::utils::redact_secrets_for_log(&out.message)
        ),
    );
    Ok(out)
}

#[tauri::command]
pub async fn postprocess_auto_punctuate(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessAutoPunctuateRequest,
) -> Result<PostprocessAutoPunctuateRawResponse, String> {
    if req.task.trim() != "auto_punctuate" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    if req.segment_uid.trim().is_empty() {
        return Err("缺少语段 uid，无法执行自动标点。".to_string());
    }
    let text = req.text.trim();
    if text.is_empty() {
        return Err("当前语段正文为空，无法执行自动标点。".to_string());
    }

    let app_root = state.root.clone();
    let config = resolve_postprocess_config_async(&req, &app_root).await?;
    let api_key = config.api_key.clone();
    let prompt = build_auto_punctuate_prompt(text, &req.neighbor_context, &req.neighbor_snippets);
    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "你是中文转写后处理助手。只给当前语段补充自然、克制的中文标点，不改写词语，不补充解释，不输出 markdown，不返回额外说明。"
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    });

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_auto_punctuate provider={} segment_uid={}",
            config.provider, req.segment_uid
        ),
    );

    let t0 = Instant::now();
    let request_id = req
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(str::to_string);
    let cancel_registration = request_id.as_ref().map(|id| {
        let (handle, registration) = AbortHandle::new_pair();
        if let Ok(mut handles) = cancel_state.0.lock() {
            if let Some(previous) = handles.insert(id.clone(), handle) {
                previous.abort();
            }
        }
        (id.clone(), registration)
    });

    let http_future = async {
        let resp = http_client()
            .post(config.endpoint.clone())
            .bearer_auth(api_key)
            .timeout(std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                append_desktop_log_line(&state, &format!("ERROR postprocess connect {e}"));
                "自动标点请求失败，请检查网络、模型配置或 API Key。".to_string()
            })?;

        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess read body {e}"));
            "自动标点返回体读取失败。".to_string()
        })?;
        Ok::<_, String>((status, payload))
    };

    let http_result = if let Some((id, registration)) = cancel_registration {
        let out = Abortable::new(http_future, registration).await;
        if let Ok(mut handles) = cancel_state.0.lock() {
            handles.remove(&id);
        }
        match out {
            Ok(result) => result,
            Err(_) => {
                append_desktop_log_line(
                    &state,
                    &format!("INFO postprocess_auto_punctuate_cancelled request_id={id}"),
                );
                return Err("自动标点请求已取消。".to_string());
            }
        }
    } else {
        http_future.await
    }?;

    let (status, payload) = http_result;

    if !status.is_success() {
        append_desktop_log_line(
            &state,
            &format!(
                "ERROR postprocess status={} body={}",
                status.as_u16(),
                crate::utils::redact_http_body_snippet(&payload)
            ),
        );
        return Err(format!(
            "自动标点服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(&state, &format!("ERROR postprocess invalid json {e}"));
        "自动标点返回格式无法解析。".to_string()
    })?;
    let candidate = extract_chat_completion_text(&json)?;
    let latency_ms = t0.elapsed().as_millis() as u64;

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_auto_punctuate_done provider={} latency_ms={latency_ms}",
            config.provider
        ),
    );

    Ok(PostprocessAutoPunctuateRawResponse {
        text: candidate,
        provider: config.provider,
        latency_ms,
    })
}

#[tauri::command]
pub async fn postprocess_refine_segments(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessRefineSegmentsRequest,
) -> Result<PostprocessRefineSegmentsResponse, String> {
    if req.task.trim() != "refine_segments" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    if req.segments.is_empty() {
        return Err("缺少语段，无法整理段界。".to_string());
    }
    for s in &req.segments {
        if s.uid.trim().is_empty() || s.text.trim().is_empty() {
            return Err("每条语段须包含 uid 与非空正文。".to_string());
        }
    }

    let app_root = state.root.clone();
    let bridge_req = PostprocessAutoPunctuateRequest {
        task: "refine_segments".to_string(),
        request_id: req.request_id.clone(),
        segment_uid: req.segments[0].uid.clone(),
        text: String::new(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: req.runtime.clone(),
    };
    let config = resolve_postprocess_config_async(&bridge_req, &app_root).await?;
    let api_key = config.api_key.clone();
    let prompt = postprocess_segment_ops::build_refine_segments_prompt(&req.segments);
    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "你是中文转写后处理助手。只输出 JSON 对象，包含 ops 与可选 rationale。"
            },
            { "role": "user", "content": prompt }
        ]
    });

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_refine_segments provider={} segment_count={}",
            config.provider,
            req.segments.len()
        ),
    );

    let t0 = Instant::now();
    let request_id = req
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(str::to_string);
    let cancel_registration = request_id.as_ref().map(|id| {
        let (handle, registration) = AbortHandle::new_pair();
        if let Ok(mut handles) = cancel_state.0.lock() {
            if let Some(previous) = handles.insert(id.clone(), handle) {
                previous.abort();
            }
        }
        (id.clone(), registration)
    });

    let http_future = async {
        let resp = http_client()
            .post(config.endpoint.clone())
            .bearer_auth(api_key)
            .timeout(std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                append_desktop_log_line(&state, &format!("ERROR postprocess refine connect {e}"));
                "段界整理请求失败，请检查网络、模型配置或 API Key。".to_string()
            })?;
        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess refine read body {e}"));
            "段界整理返回体读取失败。".to_string()
        })?;
        Ok::<_, String>((status, payload))
    };

    let http_result = if let Some((id, registration)) = cancel_registration {
        let out = Abortable::new(http_future, registration).await;
        if let Ok(mut handles) = cancel_state.0.lock() {
            handles.remove(&id);
        }
        match out {
            Ok(result) => result,
            Err(_) => {
                append_desktop_log_line(
                    &state,
                    &format!("INFO postprocess_refine_segments_cancelled request_id={id}"),
                );
                return Err("段界整理请求已取消。".to_string());
            }
        }
    } else {
        http_future.await
    }?;

    let (status, payload) = http_result;
    if !status.is_success() {
        append_desktop_log_line(
            &state,
            &format!(
                "ERROR postprocess refine status={} body={}",
                status.as_u16(),
                crate::utils::redact_http_body_snippet(&payload)
            ),
        );
        return Err(format!(
            "段界整理服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(
            &state,
            &format!("ERROR postprocess refine invalid json {e}"),
        );
        "段界整理返回格式无法解析。".to_string()
    })?;
    let raw_content = extract_chat_completion_text(&json)?;
    let parsed = postprocess_segment_ops::parse_refine_ops_json(&raw_content)?;
    postprocess_segment_ops::validate_refine_ops(&req.segments, &parsed.ops)?;

    let latency_ms = t0.elapsed().as_millis() as u64;
    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_refine_segments_done provider={} ops={} latency_ms={latency_ms}",
            config.provider,
            parsed.ops.len()
        ),
    );

    Ok(PostprocessRefineSegmentsResponse {
        ops: parsed.ops,
        rationale: parsed.rationale,
        provider: config.provider,
        latency_ms,
    })
}

#[tauri::command]
pub async fn postprocess_lexicon_proofread(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessLexiconProofreadRequest,
) -> Result<PostprocessLexiconProofreadResponse, String> {
    if req.task.trim() != "lexicon_proofread" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    if req.segments.is_empty() {
        return Err("缺少语段，无法执行词表校对。".to_string());
    }
    for s in &req.segments {
        if s.uid.trim().is_empty() || s.text.trim().is_empty() {
            return Err("每条语段须包含 uid 与非空正文。".to_string());
        }
    }

    let conn = open_db(&state)?;
    let pack = assemble_lexicon_pack(&conn)?;
    if !lexicon_pack_is_usable(&pack) {
        return Err(
            "词表为空：请先在「热词与记忆」添加术语，或通过保存语段积累纠错记忆。".to_string(),
        );
    }
    let pack_meta = pack.pack_meta.clone();

    let app_root = state.root.clone();
    let bridge_req = PostprocessAutoPunctuateRequest {
        task: "lexicon_proofread".to_string(),
        request_id: req.request_id.clone(),
        segment_uid: req.segments[0].uid.clone(),
        text: String::new(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: req.runtime.clone(),
    };
    let config = resolve_postprocess_config_async(&bridge_req, &app_root).await?;
    let api_key = config.api_key.clone();
    let prompt = postprocess_lexicon_ops::build_lexicon_proofread_prompt(&req.segments, &pack);
    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "你是中文转写校对助手。只输出 JSON 对象，包含 ops 与可选 rationale；每条修改必须带 evidence。"
            },
            { "role": "user", "content": prompt }
        ]
    });

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_lexicon_proofread provider={} segment_count={} glossary={} rules={}",
            config.provider,
            req.segments.len(),
            pack.glossary_canonical.len(),
            pack.correction_rules.len()
        ),
    );

    let t0 = Instant::now();
    let request_id = req
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(str::to_string);
    let cancel_registration = request_id.as_ref().map(|id| {
        let (handle, registration) = AbortHandle::new_pair();
        if let Ok(mut handles) = cancel_state.0.lock() {
            if let Some(previous) = handles.insert(id.clone(), handle) {
                previous.abort();
            }
        }
        (id.clone(), registration)
    });

    let http_future = async {
        let resp = http_client()
            .post(config.endpoint.clone())
            .bearer_auth(api_key)
            .timeout(std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                append_desktop_log_line(&state, &format!("ERROR postprocess lexicon connect {e}"));
                "词表校对请求失败，请检查网络、模型配置或 API Key。".to_string()
            })?;
        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess lexicon read body {e}"));
            "词表校对返回体读取失败。".to_string()
        })?;
        Ok::<_, String>((status, payload))
    };

    let http_result = if let Some((id, registration)) = cancel_registration {
        let out = Abortable::new(http_future, registration).await;
        if let Ok(mut handles) = cancel_state.0.lock() {
            handles.remove(&id);
        }
        match out {
            Ok(result) => result,
            Err(_) => {
                append_desktop_log_line(
                    &state,
                    &format!("INFO postprocess_lexicon_proofread_cancelled request_id={id}"),
                );
                return Err("词表校对请求已取消。".to_string());
            }
        }
    } else {
        http_future.await
    }?;

    let (status, payload) = http_result;
    if !status.is_success() {
        append_desktop_log_line(
            &state,
            &format!(
                "ERROR postprocess lexicon status={} body={}",
                status.as_u16(),
                crate::utils::redact_http_body_snippet(&payload)
            ),
        );
        return Err(format!(
            "词表校对服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(
            &state,
            &format!("ERROR postprocess lexicon invalid json {e}"),
        );
        "词表校对返回格式无法解析。".to_string()
    })?;
    let raw_content = extract_chat_completion_text(&json)?;
    let parsed = postprocess_lexicon_ops::parse_lexicon_proofread_json(&raw_content)?;
    let (items, warnings, dropped) =
        postprocess_lexicon_ops::filter_grounded_lexicon_ops(&pack, &req.segments, parsed.ops)?;
    if dropped > 0 {
        append_desktop_log_line(
            &state,
            &format!("WARN postprocess_lexicon_proofread dropped_ops={dropped}"),
        );
    }
    let ops: Vec<postprocess_segment_ops::SegmentRefineOp> = items
        .iter()
        .map(|g| postprocess_segment_ops::SegmentRefineOp::UpdateText {
            uid: g.uid.clone(),
            text: g.text.clone(),
        })
        .collect();

    let latency_ms = t0.elapsed().as_millis() as u64;
    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_lexicon_proofread_done provider={} ops={} latency_ms={latency_ms}",
            config.provider,
            ops.len()
        ),
    );

    Ok(PostprocessLexiconProofreadResponse {
        ops,
        items,
        warnings,
        rationale: parsed.rationale,
        pack_meta,
        provider: config.provider,
        latency_ms,
    })
}


#[tauri::command]
pub fn postprocess_cancel_auto_punctuate(
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessCancelAutoPunctuateRequest,
) -> Result<bool, String> {
    postprocess_cancel_by_request_id(&cancel_state, req.request_id.trim(), "自动标点")
}

#[tauri::command]
pub fn postprocess_cancel_export_polish(
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessCancelAutoPunctuateRequest,
) -> Result<bool, String> {
    postprocess_cancel_by_request_id(&cancel_state, req.request_id.trim(), "导出润色")
}

fn postprocess_cancel_by_request_id(
    cancel_state: &PostprocessCancelState,
    request_id: &str,
    label: &str,
) -> Result<bool, String> {
    if request_id.is_empty() {
        return Err(format!("缺少{label}请求 id。"));
    }
    let handle = cancel_state
        .0
        .lock()
        .map_err(|_| format!("{label}取消状态不可用。"))?
        .remove(request_id);
    if let Some(handle) = handle {
        handle.abort();
        Ok(true)
    } else {
        Ok(false)
    }
}

fn resolve_postprocess_config(
    req: &PostprocessAutoPunctuateRequest,
    app_data_root: &Path,
) -> Result<PostprocessConfig, String> {
    if let Some(rt) = req.runtime.as_ref() {
        return resolve_runtime_postprocess_config(rt, app_data_root);
    }
    load_postprocess_config_from_env(app_data_root)
}

async fn resolve_postprocess_config_async(
    req: &PostprocessAutoPunctuateRequest,
    app_data_root: &Path,
) -> Result<PostprocessConfig, String> {
    let req = req.clone();
    let app_data_root = app_data_root.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || resolve_postprocess_config(&req, &app_data_root))
        .await
        .map_err(|e| format!("无法解析 LLM 配置：{}", e))?
}

pub(crate) fn resolve_runtime_postprocess_config(
    rt: &PostprocessRuntimeBridge,
    app_data_root: &Path,
) -> Result<PostprocessConfig, String> {
    let base_url = rt.base_url.trim();
    let model = rt.model.trim();
    let api_key = rt.api_key.trim();
    if base_url.is_empty() {
        return Err("未配置自动标点服务地址。".to_string());
    }
    if model.is_empty() {
        return Err("未配置自动标点模型。".to_string());
    }
    let endpoint = parse_postprocess_endpoint(base_url, rt.allow_insecure_http)?;
    let provider = if rt.provider.trim().is_empty() {
        DEFAULT_PROVIDER.to_string()
    } else {
        rt.provider.trim().to_string()
    };
    let api_key = if !api_key.is_empty() {
        api_key.to_string()
    } else {
        load_postprocess_api_key(app_data_root, rt.api_key_id.as_deref())?
    };
    Ok(PostprocessConfig {
        provider,
        endpoint,
        model: model.to_string(),
        api_key,
    })
}

fn load_postprocess_config_from_env(app_data_root: &Path) -> Result<PostprocessConfig, String> {
    let provider =
        env::var("RUSHI_POSTPROCESS_PROVIDER").unwrap_or_else(|_| DEFAULT_PROVIDER.to_string());
    let base_url = env::var("RUSHI_POSTPROCESS_BASE_URL").map_err(|_| {
        "未配置 LLM：请在「设置 → LLM 配置」填写连接信息，或设置 RUSHI_POSTPROCESS_BASE_URL。"
            .to_string()
    })?;
    let model = env::var("RUSHI_POSTPROCESS_MODEL")
        .map_err(|_| "未配置自动标点模型：请设置 RUSHI_POSTPROCESS_MODEL。".to_string())?;
    let api_key_id = env::var("RUSHI_POSTPROCESS_API_KEY_ID")
        .ok()
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty());
    let allow_insecure_http = env::var("RUSHI_POSTPROCESS_ALLOW_INSECURE_HTTP")
        .ok()
        .is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"));
    let endpoint = parse_postprocess_endpoint(&base_url, allow_insecure_http)?;
    let api_key = load_postprocess_api_key(app_data_root, api_key_id.as_deref())?;
    Ok(PostprocessConfig {
        provider,
        endpoint,
        model,
        api_key,
    })
}

fn parse_postprocess_endpoint(raw: &str, allow_insecure_http: bool) -> Result<Url, String> {
    let mut url = Url::parse(raw.trim())
        .map_err(|_| "自动标点服务地址无效，请检查 API 基址。".to_string())?;
    match url.scheme() {
        "https" => {}
        "http" if allow_insecure_http && is_loopback_host(url.host_str()) => {}
        _ => {
            return Err("自动标点服务地址必须为 HTTPS；本地开发仅允许 loopback HTTP。".to_string())
        }
    }

    let path = url.path().trim_end_matches('/');
    if path.is_empty() || path == "/" {
        url.set_path("/v1/chat/completions");
    } else if !path.ends_with("/chat/completions") {
        url.set_path(&format!("{path}/chat/completions"));
    }
    Ok(url)
}

pub(crate) fn build_postprocess_models_endpoint(chat_endpoint: &Url) -> Url {
    let mut url = chat_endpoint.clone();
    let path = url.path().trim_end_matches('/');
    let next = if path.is_empty() || path == "/" {
        "/v1/models".to_string()
    } else if let Some(prefix) = path.strip_suffix("/chat/completions") {
        let prefix = prefix.trim_end_matches('/');
        if prefix.is_empty() {
            "/v1/models".to_string()
        } else {
            format!("{prefix}/models")
        }
    } else if path.ends_with("/models") {
        path.to_string()
    } else {
        format!("{path}/models")
    };
    url.set_path(&next);
    url
}

fn is_loopback_host(host: Option<&str>) -> bool {
    matches!(host, Some("127.0.0.1" | "localhost" | "::1"))
}

fn is_valid_secret_account_id(id: &str) -> bool {
    let id = id.trim();
    if id.is_empty() || id.len() > 48 {
        return false;
    }
    if id.starts_with("sk-") || id.starts_with("Bearer ") {
        return false;
    }
    id.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn normalize_api_key_id(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|x| !x.is_empty())
        .filter(|x| is_valid_secret_account_id(x))
        .unwrap_or(DEFAULT_API_KEY_ID)
        .to_string()
}

fn load_postprocess_api_key(
    app_data_root: &Path,
    api_key_id: Option<&str>,
) -> Result<String, String> {
    let id = normalize_api_key_id(api_key_id);
    if let Some(key) = read_llm_secret(app_data_root, &id)? {
        return Ok(key);
    }

    let fallback = env::var("RUSHI_POSTPROCESS_API_KEY")
        .ok()
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty());
    if let Some(key) = fallback {
        return Ok(key);
    }

    Err(format!(
        "本地未找到 API Key（标识：{id}）。请在「设置 → LLM 配置」重新填写并保存。"
    ))
}

fn build_auto_punctuate_prompt(
    text: &str,
    neighbor_context: &[NeighborContextItem],
    legacy_snippets: &[String],
) -> String {
    let mut lines = vec![
        "任务：仅为“当前语段”补充自然中文标点。".to_string(),
        "约束：".to_string(),
        "1. 不改写词语，不补充省略内容。".to_string(),
        "2. 不输出解释，不加引号标题。".to_string(),
        "3. 仅返回处理后的当前语段正文。".to_string(),
    ];
    let context_lines = if !neighbor_context.is_empty() {
        neighbor_context
            .iter()
            .filter_map(|item| {
                let snippet = item.text.trim();
                if snippet.is_empty() {
                    return None;
                }
                let label = match item.role.trim() {
                    "prev" => "上一语段",
                    "next" => "下一语段",
                    other if !other.is_empty() => other,
                    _ => "上下文",
                };
                Some(format!("{label}：{snippet}"))
            })
            .collect::<Vec<_>>()
    } else {
        legacy_snippets
            .iter()
            .enumerate()
            .filter_map(|(idx, snippet)| {
                let trimmed = snippet.trim();
                if trimmed.is_empty() {
                    return None;
                }
                Some(format!("片段{}：{trimmed}", idx + 1))
            })
            .collect::<Vec<_>>()
    };
    if !context_lines.is_empty() {
        lines.push("上下文（仅辅助判断停顿，不可合并进结果）：".to_string());
        lines.extend(context_lines);
    }
    lines.push("当前语段：".to_string());
    lines.push(text.to_string());
    lines.join("\n")
}

fn extract_chat_completion_text(v: &serde_json::Value) -> Result<String, String> {
    let Some(choice) = v.get("choices").and_then(|x| x.get(0)) else {
        return Err("自动标点返回缺少 choices。".to_string());
    };
    let Some(content) = choice.get("message").and_then(|x| x.get("content")) else {
        return Err("自动标点返回缺少 message.content。".to_string());
    };
    let out = if let Some(text) = content.as_str() {
        text.trim().to_string()
    } else if let Some(parts) = content.as_array() {
        parts
            .iter()
            .filter_map(|p| p.get("text").and_then(|x| x.as_str()))
            .collect::<Vec<_>>()
            .join("")
            .trim()
            .to_string()
    } else {
        String::new()
    };
    if out.is_empty() {
        return Err("自动标点返回内容为空。".to_string());
    }
    Ok(out)
}

#[cfg(test)]
#[path = "postprocess_cmd_tests.rs"]
mod tests;

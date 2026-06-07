use super::postprocess_config::{
    is_valid_secret_account_id, normalize_api_key_id, resolve_runtime_postprocess_config,
    DEFAULT_API_KEY_ID,
};
use super::postprocess_secret_store::{
    delete_llm_secret, llm_secret_exists, read_llm_secret, write_llm_secret,
};
use super::LlmProbeConnectionResponse;
use crate::project::utils::append_desktop_log_line;
use crate::DbState;
use serde::Deserialize;
use tauri::State;

use super::PostprocessRuntimeBridge;

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

#[derive(Debug, Deserialize)]
pub struct OllamaDetectRequest {
    #[serde(default, alias = "tags_url")]
    pub tags_url: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

pub(crate) fn secret_account_for_delete(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|x| !x.is_empty())
        .unwrap_or(DEFAULT_API_KEY_ID)
        .to_string()
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
pub async fn llm_probe_connection(
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
    let out = tauri::async_runtime::spawn_blocking(move || {
        super::postprocess_probe::probe_llm_connection_blocking(
            &config,
            super::postprocess_probe::PROBE_TIMEOUT,
        )
    })
    .await
    .map_err(|e| format!("探测任务被取消：{e}"))?;
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
pub async fn ollama_detect_status(
    req: OllamaDetectRequest,
) -> super::postprocess_ollama::OllamaDetectResponse {
    super::postprocess_ollama::detect_ollama_tags(req.tags_url.as_deref(), req.model.as_deref())
        .await
}

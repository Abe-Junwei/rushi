use super::postprocess_cmd::postprocess_api_key_cmd::secret_account_for_delete;
use super::postprocess_cmd::normalize_api_key_id;
use super::stt_online_secret_store::{
    delete_stt_secret, read_stt_secret, stt_secret_exists, write_stt_secret,
};
use crate::DbState;
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttSaveApiKeyRequest {
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
    #[serde(alias = "api_key")]
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttDeleteApiKeyRequest {
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttHasStoredApiKeyRequest {
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttReadApiKeyRequest {
    #[serde(default, alias = "api_key_id")]
    pub api_key_id: Option<String>,
}

#[tauri::command]
pub fn stt_has_stored_api_key(
    state: State<'_, DbState>,
    req: SttHasStoredApiKeyRequest,
) -> Result<bool, String> {
    let api_key_id = normalize_api_key_id(req.api_key_id.as_deref());
    stt_secret_exists(&state.root, &api_key_id)
}

#[tauri::command]
pub fn stt_save_api_key(
    state: State<'_, DbState>,
    req: SttSaveApiKeyRequest,
) -> Result<String, String> {
    let api_key = req.api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 为空，无法保存。".to_string());
    }
    let api_key_id = normalize_api_key_id(req.api_key_id.as_deref());
    write_stt_secret(&state.root, &api_key_id, api_key)?;
    Ok(api_key_id)
}

#[tauri::command]
pub fn stt_delete_api_key(
    state: State<'_, DbState>,
    req: SttDeleteApiKeyRequest,
) -> Result<(), String> {
    let api_key_id = secret_account_for_delete(req.api_key_id.as_deref());
    delete_stt_secret(&state.root, &api_key_id)
}

#[tauri::command]
pub fn stt_read_api_key(
    state: State<'_, DbState>,
    req: SttReadApiKeyRequest,
) -> Result<Option<String>, String> {
    let api_key_id = normalize_api_key_id(req.api_key_id.as_deref());
    read_stt_secret(&state.root, &api_key_id)
}

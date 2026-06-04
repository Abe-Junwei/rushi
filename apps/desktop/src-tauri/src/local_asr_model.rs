//! Persisted FunASR hub model preference for bundled sidecar spawn.

use crate::DbState;
use std::path::PathBuf;
use tauri::State;

const PREF_REL: &str = "prefs/funasr_hub_model_id.txt";

/// Keep in sync with `services/asr/rushi_asr/defaults.py` / desktop `localAsrModelCatalog.ts`.
pub const DEFAULT_FUNASR_HUB_MODEL_ID: &str =
    "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";

const DEPRECATED_FUNASR_HUB_MODEL_IDS: &[&str] = &["iic/SenseVoiceSmall"];

pub fn normalize_hub_model_id(hub_model_id: &str) -> String {
    let trimmed = hub_model_id.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if DEPRECATED_FUNASR_HUB_MODEL_IDS.contains(&trimmed) {
        return DEFAULT_FUNASR_HUB_MODEL_ID.to_string();
    }
    trimmed.to_string()
}

pub fn pref_path(st: &DbState) -> PathBuf {
    st.root.join(PREF_REL)
}

pub fn read_hub_model_pref_for_app_root(app_data_root: &std::path::Path) -> Option<String> {
    let p = app_data_root.join(PREF_REL);
    let Ok(raw) = std::fs::read_to_string(&p) else {
        return None;
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let normalized = normalize_hub_model_id(trimmed);
    if normalized != trimmed {
        let path = app_data_root.join(PREF_REL);
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let tmp = path.with_extension("txt.tmp");
        if std::fs::write(&tmp, format!("{normalized}\n")).is_ok() {
            let _ = std::fs::rename(&tmp, &path);
        }
    }
    Some(normalized)
}

pub fn read_hub_model_pref(st: &DbState) -> Option<String> {
    read_hub_model_pref_for_app_root(&st.root)
}

pub fn write_hub_model_pref(st: &DbState, hub_model_id: &str) -> Result<(), String> {
    let hub = normalize_hub_model_id(hub_model_id);
    if hub.is_empty() {
        return Err("hub_model_id 不能为空".into());
    }
    let path = pref_path(st);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("无法创建 prefs 目录：{e}"))?;
    }
    let tmp = path.with_extension("txt.tmp");
    std::fs::write(&tmp, format!("{hub}\n")).map_err(|e| format!("无法写入模型偏好：{e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("无法写入模型偏好：{e}"))
}

#[tauri::command]
pub fn get_local_asr_hub_model_pref(state: State<'_, DbState>) -> Result<Option<String>, String> {
    Ok(read_hub_model_pref(state.inner()))
}

#[tauri::command]
pub async fn set_local_asr_hub_model_pref(
    hub_model_id: String,
    restart_sidecar: Option<bool>,
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let hub = hub_model_id.trim();
    if hub.is_empty() {
        return Err("hub_model_id 不能为空".into());
    }
    write_hub_model_pref(state.inner(), hub)?;
    // Restart is explicit via `retry_bundled_asr_sidecar` / apply-model flow — avoid
    // skipping restart when pref file already matches but the running process is stale.
    if restart_sidecar == Some(true) && crate::asr_sidecar::app_manages_bundled_sidecar() {
        let app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            crate::asr_sidecar::force_restart_bundled(&app);
        })
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn read_write_hub_model_pref_roundtrip() {
        let tmp =
            std::env::temp_dir().join(format!("rushi-local-asr-model-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let st = DbState {
            root: tmp.clone(),
            db_path: tmp.join("app.db"),
        };
        assert_eq!(read_hub_model_pref(&st), None);
        write_hub_model_pref(&st, "iic/SenseVoiceSmall").unwrap();
        assert_eq!(
            read_hub_model_pref(&st).as_deref(),
            Some(DEFAULT_FUNASR_HUB_MODEL_ID)
        );
        let _ = fs::remove_dir_all(&tmp);
    }
}

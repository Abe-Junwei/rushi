//! Persisted FunASR recognition language for bundled sidecar spawn (R3g-C C4).

use crate::DbState;
use std::path::PathBuf;
use tauri::State;

const PREF_REL: &str = "prefs/funasr_language.txt";
pub const DEFAULT_FUNASR_LANGUAGE: &str = "zh";

pub fn pref_path(st: &DbState) -> PathBuf {
    st.root.join(PREF_REL)
}

/// Same allowlist as `services/asr/rushi_asr/funasr_engine.py`.
pub fn normalize_funasr_language(raw: Option<&str>) -> &'static str {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some("en") => "en",
        Some("ja") => "ja",
        Some("ko") => "ko",
        Some("yue") => "yue",
        Some("auto") => "auto",
        Some("zh") => "zh",
        _ => DEFAULT_FUNASR_LANGUAGE,
    }
}

pub fn read_language_pref_for_app_root(app_data_root: &std::path::Path) -> String {
    let p = app_data_root.join(PREF_REL);
    let Ok(raw) = std::fs::read_to_string(&p) else {
        return DEFAULT_FUNASR_LANGUAGE.to_string();
    };
    normalize_funasr_language(Some(&raw)).to_string()
}

pub fn read_language_pref(st: &DbState) -> String {
    read_language_pref_for_app_root(&st.root)
}

pub fn write_language_pref(st: &DbState, language: &str) -> Result<(), String> {
    let normalized = normalize_funasr_language(Some(language));
    let path = pref_path(st);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("无法创建 prefs 目录：{e}"))?;
    }
    let tmp = path.with_extension("txt.tmp");
    std::fs::write(&tmp, format!("{normalized}\n"))
        .map_err(|e| format!("无法写入识别语言偏好：{e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("无法写入识别语言偏好：{e}"))
}

#[tauri::command]
pub fn get_local_asr_recognition_language_pref(
    state: State<'_, DbState>,
) -> Result<String, String> {
    Ok(read_language_pref(state.inner()))
}

#[tauri::command]
pub async fn set_local_asr_recognition_language_pref(
    language: String,
    restart_sidecar: Option<bool>,
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let normalized = normalize_funasr_language(Some(&language));
    write_language_pref(state.inner(), normalized)?;
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
    fn normalize_funasr_language_allowlist() {
        assert_eq!(normalize_funasr_language(Some("auto")), "auto");
        assert_eq!(normalize_funasr_language(Some(" zh ")), "zh");
        assert_eq!(normalize_funasr_language(Some("fr")), "zh");
        assert_eq!(normalize_funasr_language(None), "zh");
    }

    #[test]
    fn read_write_language_pref_roundtrip() {
        let tmp = std::env::temp_dir().join(format!("rushi-local-asr-lang-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let st = DbState::open_test_db_at(tmp.clone(), tmp.join("app.db"));
        assert_eq!(read_language_pref(&st), "zh");
        write_language_pref(&st, "auto").unwrap();
        assert_eq!(read_language_pref(&st).as_str(), "auto");
        let _ = fs::remove_dir_all(&tmp);
    }
}

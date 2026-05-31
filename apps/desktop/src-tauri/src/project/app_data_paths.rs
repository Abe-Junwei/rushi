//! Canonical app-data / models paths (shared by DB, bundled ASR spawn, and diagnostics).

use std::path::{Path, PathBuf};

/// `app_data_dir()` already includes bundle id; legacy builds nested another `studio.lingchuang.rushi`.
pub fn resolve_app_data_root(app_data: PathBuf) -> PathBuf {
    let legacy = app_data.join("studio.lingchuang.rushi");
    let has_legacy_state = legacy.join("rushi.sqlite3").is_file()
        || legacy.join("models").is_dir()
        || legacy.join("logs").is_dir()
        || legacy.join("projects").is_dir();
    if has_legacy_state {
        return legacy;
    }
    app_data
}

pub fn models_root_for_app_data_root(app_data_root: &Path) -> PathBuf {
    app_data_root.join("models")
}

pub fn modelscope_cache_for_models_root(models_root: &Path) -> PathBuf {
    models_root.join("modelscope")
}

pub fn huggingface_cache_for_models_root(models_root: &Path) -> PathBuf {
    models_root.join("huggingface")
}

/// Same env triple (+ optional hub + language) as bundled sidecar spawn and dev scripts.
pub fn apply_asr_model_env(
    cmd: &mut std::process::Command,
    models_root: &Path,
    hub_model: Option<&str>,
    language: Option<&str>,
) {
    let _ = std::fs::create_dir_all(models_root);
    cmd.env("RUSHI_MODELS_ROOT", models_root);
    let ms = modelscope_cache_for_models_root(models_root);
    let hf = huggingface_cache_for_models_root(models_root);
    let _ = std::fs::create_dir_all(&ms);
    let _ = std::fs::create_dir_all(&hf);
    cmd.env("MODELSCOPE_CACHE", &ms);
    cmd.env("HF_HOME", &hf);
    if let Some(hub) = hub_model.map(str::trim).filter(|s| !s.is_empty()) {
        cmd.env("RUSHI_FUNASR_MODEL", hub);
    }
    cmd.env(
        "RUSHI_FUNASR_LANGUAGE",
        crate::local_asr_language::normalize_funasr_language(language),
    );
}

#[cfg(test)]
mod tests {
    use super::resolve_app_data_root;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn prefers_legacy_nested_root_when_sqlite_there() {
        let base = std::env::temp_dir().join(format!("rushi-paths-{}", Uuid::new_v4()));
        let legacy = base.join("studio.lingchuang.rushi");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("rushi.sqlite3"), b"x").unwrap();
        assert_eq!(resolve_app_data_root(base.clone()), legacy);
        let _ = fs::remove_dir_all(base);
    }
}

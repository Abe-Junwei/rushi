use crate::DbState;
use serde::Serialize;
use std::ops::Deref;
use tauri::State;

use super::app_data_paths::{
    huggingface_cache_for_models_root, models_root_for_app_data_root,
    modelscope_cache_for_models_root,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrRuntimePaths {
    pub app_data_root: String,
    pub models_root: String,
    pub modelscope_cache: String,
    pub huggingface_cache: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::app_data_paths::{
        huggingface_cache_for_models_root, models_root_for_app_data_root,
        modelscope_cache_for_models_root,
    };
    use crate::DbState;
    use std::fs;

    #[test]
    fn runtime_paths_match_helpers() {
        let tmp = std::env::temp_dir().join(format!("rushi-runtime-paths-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let st = DbState::open_test_db(tmp.clone());
        let models = models_root_for_app_data_root(&st.root);
        let paths = AsrRuntimePaths {
            app_data_root: st.root.to_string_lossy().to_string(),
            models_root: models.to_string_lossy().to_string(),
            modelscope_cache: modelscope_cache_for_models_root(&models)
                .to_string_lossy()
                .to_string(),
            huggingface_cache: huggingface_cache_for_models_root(&models)
                .to_string_lossy()
                .to_string(),
        };
        assert_eq!(paths.models_root, models.to_string_lossy());
        let _ = fs::remove_dir_all(&tmp);
    }
}

#[tauri::command]
pub fn get_asr_runtime_paths(state: State<'_, DbState>) -> AsrRuntimePaths {
    let st = state.deref();
    let models = models_root_for_app_data_root(&st.root);
    AsrRuntimePaths {
        app_data_root: st.root.to_string_lossy().to_string(),
        modelscope_cache: modelscope_cache_for_models_root(&models)
            .to_string_lossy()
            .to_string(),
        huggingface_cache: huggingface_cache_for_models_root(&models)
            .to_string_lossy()
            .to_string(),
        models_root: models.to_string_lossy().to_string(),
    }
}

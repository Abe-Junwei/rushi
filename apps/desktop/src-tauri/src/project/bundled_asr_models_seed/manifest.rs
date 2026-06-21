//! Manifest and model-cache validation for bundled ASR models seed.

use std::fs;
use std::path::{Path, PathBuf};

use super::safe_rel_path_under;
use super::{OfflineAsrModelsPackManifest, ResolvedPackModelSpec};

pub fn read_manifest_from_dir(root: &Path) -> Result<OfflineAsrModelsPackManifest, String> {
    let path = root.join("manifest.json");
    let body = fs::read_to_string(&path)
        .map_err(|e| format!("读取 manifest 失败（{}）: {e}", path.display()))?;
    serde_json::from_str(&body).map_err(|e| format!("manifest 格式无效: {e}"))
}

fn model_dir_candidates(root: &Path, model_id: &str) -> Vec<PathBuf> {
    let parts: Vec<_> = model_id.split('/').collect();
    if parts.len() != 2 {
        return Vec::new();
    }
    let (owner, name) = (parts[0], parts[1]);
    let escaped = name.replace('.', "___");
    let mut candidates = vec![
        root.join("models").join(owner).join(name),
        root.join("models").join(owner).join(&escaped),
        root.join("hub").join("models").join(owner).join(name),
        root.join("hub").join("models").join(owner).join(&escaped),
        root.join("hub").join(owner).join(name),
        root.join("hub").join(owner).join(&escaped),
    ];
    candidates.sort();
    candidates.dedup();
    candidates
}

fn looks_like_complete_model_dir(
    model_dir: &Path,
    required_files: &[String],
    min_weight_bytes: u64,
    weight_file: &str,
) -> bool {
    if !model_dir.is_dir() {
        return false;
    }
    for rel in required_files {
        let file_path = match safe_rel_path_under(model_dir, rel) {
            Ok(path) => path,
            Err(_) => return false,
        };
        if !file_path.is_file() {
            return false;
        }
    }
    let weight_path = match safe_rel_path_under(model_dir, weight_file) {
        Ok(path) => path,
        Err(_) => return false,
    };
    match fs::metadata(&weight_path) {
        Ok(meta) if meta.is_file() => meta.len() > min_weight_bytes,
        _ => false,
    }
}

pub fn find_cached_model_dir(
    modelscope_cache: &Path,
    hub_id: &str,
    required_files: &[String],
    min_weight_bytes: u64,
    weight_file: &str,
) -> Option<PathBuf> {
    model_dir_candidates(modelscope_cache, hub_id)
        .into_iter()
        .find(|candidate| {
            looks_like_complete_model_dir(candidate, required_files, min_weight_bytes, weight_file)
        })
}

pub fn validate_manifest_models_cached(
    modelscope_cache: &Path,
    specs: &[ResolvedPackModelSpec],
) -> Result<(), String> {
    for spec in specs {
        if find_cached_model_dir(
            modelscope_cache,
            &spec.hub_id,
            &spec.required_files,
            spec.min_weight_bytes,
            &spec.weight_file,
        )
        .is_none()
        {
            return Err(format!(
                "复制后仍缺少完整模型：{}（请确认安装包未损坏）。",
                spec.hub_id
            ));
        }
    }
    Ok(())
}

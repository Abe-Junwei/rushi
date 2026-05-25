use crate::DbState;
use serde::Serialize;
use std::fs;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct AsrModelCacheInfo {
    pub models_root: String,
    pub modelscope_cache: String,
    pub huggingface_cache: String,
    pub exists: bool,
    pub total_bytes: u64,
    pub manifest_path: Option<String>,
    pub manifest_exists: bool,
}

#[tauri::command]
pub fn asr_model_cache_info(state: State<DbState>) -> Result<AsrModelCacheInfo, String> {
    let st: &DbState = state.deref();
    inspect_asr_model_cache(st)
}

#[tauri::command]
pub fn clear_asr_model_cache(state: State<DbState>) -> Result<AsrModelCacheInfo, String> {
    let st: &DbState = state.deref();
    clear_asr_model_cache_for_state(st)?;
    inspect_asr_model_cache(st)
}

fn inspect_asr_model_cache(st: &DbState) -> Result<AsrModelCacheInfo, String> {
    let root = models_root(st);
    fs::create_dir_all(&root).map_err(|e| format!("创建模型缓存目录失败: {e}"))?;
    let manifest_path = resolve_manifest_path(manifest_raw_from_env(), &root);
    let total_bytes = dir_size_bytes(&root).map_err(|e| format!("读取模型缓存占用失败: {e}"))?;
    Ok(AsrModelCacheInfo {
        models_root: root.to_string_lossy().to_string(),
        modelscope_cache: root.join("modelscope").to_string_lossy().to_string(),
        huggingface_cache: root.join("huggingface").to_string_lossy().to_string(),
        exists: root.exists(),
        total_bytes,
        manifest_exists: manifest_path.as_ref().is_some_and(|p| p.is_file()),
        manifest_path: manifest_path.map(|p| p.to_string_lossy().to_string()),
    })
}

fn clear_asr_model_cache_for_state(st: &DbState) -> Result<(), String> {
    let root = models_root(st);
    fs::create_dir_all(&root).map_err(|e| format!("创建模型缓存目录失败: {e}"))?;
    let preserve_manifest = resolve_manifest_path(manifest_raw_from_env(), &root)
        .and_then(|p| p.canonicalize().ok());
    clear_cache_contents(&root, preserve_manifest.as_deref())
}

fn models_root(st: &DbState) -> PathBuf {
    st.root.join("models")
}

fn manifest_raw_from_env() -> Option<String> {
    let raw = std::env::var("RUSHI_MODEL_VERIFY_MANIFEST").ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn resolve_manifest_path(raw: Option<String>, root: &Path) -> Option<PathBuf> {
    let raw = raw?;
    let path = PathBuf::from(raw);
    Some(if path.is_absolute() { path } else { root.join(path) })
}

fn clear_cache_contents(root: &Path, preserve_manifest: Option<&Path>) -> Result<(), String> {
    let preserve_manifest = preserve_manifest.and_then(|p| p.canonicalize().ok());
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let canonical = path.canonicalize().ok();
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if meta.is_dir() {
            let contains_preserved = preserve_manifest
                .as_deref()
                .zip(canonical.as_deref())
                .is_some_and(|(preserve, current)| preserve.starts_with(current));
            if contains_preserved {
                clear_cache_contents(&path, preserve_manifest.as_deref())?;
                if fs::read_dir(&path).map_err(|e| e.to_string())?.next().is_none() {
                    fs::remove_dir(&path)
                        .map_err(|e| format!("删除空缓存目录失败（{}）: {e}", path.display()))?;
                }
            } else {
                fs::remove_dir_all(&path)
                    .map_err(|e| format!("删除缓存目录失败（{}）: {e}", path.display()))?;
            }
        } else {
            let should_preserve = preserve_manifest
                .as_deref()
                .zip(canonical.as_deref())
                .is_some_and(|(preserve, current)| preserve == current);
            if should_preserve {
                continue;
            }
            fs::remove_file(&path).map_err(|e| format!("删除缓存文件失败（{}）: {e}", path.display()))?;
        }
    }
    Ok(())
}

fn dir_size_bytes(path: &Path) -> Result<u64, std::io::Error> {
    if !path.exists() {
        return Ok(0);
    }
    let meta = fs::symlink_metadata(path)?;
    if meta.is_file() {
        return Ok(meta.len());
    }
    if !meta.is_dir() {
        return Ok(0);
    }
    let mut total = 0_u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        total = total.saturating_add(dir_size_bytes(&entry.path())?);
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::{clear_cache_contents, dir_size_bytes, resolve_manifest_path};
    use std::fs;
    use std::path::Path;
    use uuid::Uuid;

    fn temp_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("rushi-asr-cache-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn resolve_relative_manifest_against_models_root() {
        let root = Path::new("/tmp/rushi-models");
        let manifest = resolve_manifest_path(Some("manifest/default.json".to_string()), root).unwrap();
        assert_eq!(manifest, root.join("manifest/default.json"));
    }

    #[test]
    fn directory_size_counts_nested_files() {
        let temp = temp_dir();
        let nested = temp.join("a/b");
        fs::create_dir_all(&nested).unwrap();
        fs::write(temp.join("root.bin"), vec![0_u8; 5]).unwrap();
        fs::write(nested.join("child.bin"), vec![0_u8; 7]).unwrap();
        assert_eq!(dir_size_bytes(&temp).unwrap(), 12);
        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn clear_cache_preserves_manifest_file_when_requested() {
        let temp = temp_dir();
        let root = temp.as_path();
        let manifest_dir = root.join("manifest");
        fs::create_dir_all(&manifest_dir).unwrap();
        let manifest = manifest_dir.join("manifest.json");
        fs::write(&manifest, "{}").unwrap();
        fs::create_dir_all(root.join("modelscope/hub")).unwrap();
        fs::write(root.join("modelscope/hub/model.bin"), vec![1_u8; 8]).unwrap();
        fs::create_dir_all(root.join("huggingface")).unwrap();
        fs::write(root.join("huggingface/token"), vec![2_u8; 3]).unwrap();

        clear_cache_contents(root, Some(&manifest)).unwrap();

        assert!(manifest.is_file());
        assert!(manifest_dir.is_dir());
        assert!(!root.join("modelscope").exists());
        assert!(!root.join("huggingface").exists());
        let _ = fs::remove_dir_all(&temp);
    }
}

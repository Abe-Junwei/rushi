//! First-launch seed of bundled default FunASR models (Plan B) into App Data cache.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock, TryLockError};

use serde::Serialize;
use tauri::{AppHandle, State};

pub use super::bundled_asr_models_manifest::{
    resolve_model_specs, BundledAsrModelsManifest, ResolvedBundledAsrModelSpec,
};
use crate::bundled_asr_assets;
use crate::project::app_data_paths::{
    models_root_for_app_data_root, modelscope_cache_for_models_root,
};
use crate::DbState;

mod copy;
mod manifest;
mod marker;
mod progress;

pub const BUNDLED_ASR_MODELS_SEED_PROGRESS_EVENT: &str = "bundled-asr-models-seed-progress";
const SEED_STAGING_DIR: &str = ".rushi-bundled-seed-staging";

static SEED_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub fn is_bundled_asr_models_seed_in_progress() -> bool {
    matches!(seed_lock().try_lock(), Err(TryLockError::WouldBlock))
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BundledAsrModelsSeedResult {
    pub status: String,
    pub imported_bytes: u64,
    pub models_root: String,
    pub modelscope_cache: String,
    pub pack_version: u32,
    pub bundle_id: String,
    pub seeded_at: String,
    #[serde(default)]
    pub skipped_reseed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledAsrModelsSeedProgressPayload {
    pub phase: String,
    pub copied_bytes: u64,
    pub total_bytes: u64,
    pub percent: u8,
}

fn seed_lock() -> &'static Mutex<()> {
    SEED_LOCK.get_or_init(|| Mutex::new(()))
}

fn acquire_seed_lock() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    match seed_lock().try_lock() {
        Ok(guard) => Ok(guard),
        Err(TryLockError::WouldBlock) => Err("内置语音模型正在准备中，请稍候。".to_string()),
        Err(TryLockError::Poisoned(_)) => Err("模型准备锁异常，请重启应用后再试。".to_string()),
    }
}

pub(crate) fn safe_rel_path_under(base: &Path, rel: &str) -> Result<PathBuf, String> {
    let mut out = base.to_path_buf();
    for component in Path::new(rel).components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("模型路径无效。".to_string());
            }
        }
    }
    Ok(out)
}

fn cleanup_stale_seed_staging(models_root: &Path) {
    let staging_root = models_root.join(SEED_STAGING_DIR);
    if staging_root.is_dir() {
        let _ = fs::remove_dir_all(staging_root);
    }
}

pub fn seed_bundled_asr_models_at(
    models_root: &Path,
    pack_root: &Path,
    app: Option<&AppHandle>,
) -> Result<BundledAsrModelsSeedResult, String> {
    let _guard = acquire_seed_lock()?;
    let staging_dir = models_root
        .join(SEED_STAGING_DIR)
        .join(uuid::Uuid::new_v4().to_string());
    let result = (|| {
        let manifest = manifest::read_manifest_from_dir(pack_root)?;
        let specs = resolve_model_specs(&manifest)?;
        fs::create_dir_all(models_root).map_err(|e| format!("创建 models 目录失败: {e}"))?;
        let modelscope_cache = modelscope_cache_for_models_root(models_root);
        fs::create_dir_all(&modelscope_cache)
            .map_err(|e| format!("创建 ModelScope 缓存失败: {e}"))?;

        cleanup_stale_seed_staging(models_root);

        if let Some(skipped) =
            marker::try_skip_reseed(models_root, &modelscope_cache, &manifest, &specs)?
        {
            return Ok(skipped);
        }

        progress::emit_progress(app, "validate", 0, 1);
        fs::create_dir_all(&staging_dir).map_err(|e| format!("创建 seed 暂存目录失败: {e}"))?;
        let staging_modelscope = staging_dir.join("modelscope");
        let mut discard_rollback = Vec::new();
        let copied_to_staging = copy::copy_modelscope_tree(
            pack_root,
            &staging_modelscope,
            app,
            "copy",
            &mut discard_rollback,
        )?;
        manifest::validate_manifest_models_cached(&staging_modelscope, &specs)?;
        progress::emit_progress(app, "merge", 0, 1);
        let mut merge_rollback = Vec::new();
        let merge_result = copy::copy_modelscope_tree(
            &staging_dir,
            &modelscope_cache,
            app,
            "merge",
            &mut merge_rollback,
        );
        if let Err(err) = merge_result {
            copy::rollback_new_files(&merge_rollback, &modelscope_cache);
            progress::log_seed_detail(app, &format!("ERROR bundled seed merge rollback: {err}"));
            return Err(err);
        }
        let merged_bytes = merge_result.unwrap_or(0);
        if let Err(err) = manifest::validate_manifest_models_cached(&modelscope_cache, &specs) {
            copy::rollback_new_files(&merge_rollback, &modelscope_cache);
            progress::log_seed_detail(app, &format!("ERROR bundled seed validate rollback: {err}"));
            return Err(err);
        }
        marker::write_seed_marker(models_root, &manifest)?;
        let seeded_at = chrono::Local::now().to_rfc3339();
        Ok(BundledAsrModelsSeedResult {
            status: "seeded".to_string(),
            imported_bytes: copied_to_staging.max(merged_bytes),
            models_root: models_root.to_string_lossy().to_string(),
            modelscope_cache: modelscope_cache.to_string_lossy().to_string(),
            pack_version: manifest.pack_version,
            bundle_id: manifest.bundle_id,
            seeded_at,
            skipped_reseed: false,
        })
    })();
    let _ = fs::remove_dir_all(&staging_dir);
    result
}

#[tauri::command]
pub async fn seed_bundled_asr_models_if_needed(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<BundledAsrModelsSeedResult, String> {
    let Some(pack_root) = bundled_asr_assets::resolve_bundled_asr_models_pack_root() else {
        let st = state.inner();
        crate::project::utils::append_desktop_log_line(
            st,
            "WARN bundled seed: skipped_no_bundle (manifest.json+modelscope/ not in resource roots)",
        );
        return Ok(BundledAsrModelsSeedResult {
            status: "skipped_no_bundle".to_string(),
            imported_bytes: 0,
            models_root: String::new(),
            modelscope_cache: String::new(),
            pack_version: 0,
            bundle_id: String::new(),
            seeded_at: String::new(),
            skipped_reseed: true,
        });
    };
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let models_root = models_root_for_app_data_root(&st.root);
        crate::project::utils::append_desktop_log_line(
            &st,
            &format!(
                "INFO bundled seed: pack_root={} models_root={}",
                pack_root.display(),
                models_root.display()
            ),
        );
        seed_bundled_asr_models_at(&models_root, &pack_root, Some(&app))
    })
    .await
    .map_err(|e| format!("模型准备任务失败: {e}"))?
}

#[cfg(test)]
mod tests;

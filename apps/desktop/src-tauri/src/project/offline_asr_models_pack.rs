//! Import optional offline FunASR model packs (Route E) into App Data ModelScope cache.

use std::fs::{self, File};
use std::io::{copy, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock, TryLockError};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, State};
use zip::ZipArchive;

#[allow(unused_imports)]
pub use super::offline_asr_models_pack_manifest::{
    default_offline_asr_models_pack_manifest, resolve_model_specs, sanitize_manifest_rel_path,
    OfflineAsrModelsPackManifest, OfflineAsrModelsPackModelSpec, ResolvedPackModelSpec,
    DEFAULT_OFFLINE_ASR_BUNDLE_ID, OFFLINE_ASR_MODELS_PACK_VERSION,
};
use crate::project::app_data_paths::{modelscope_cache_for_models_root, models_root_for_app_data_root};
use crate::DbState;

pub const OFFLINE_ASR_MODELS_PACK_PROGRESS_EVENT: &str = "offline-asr-models-pack-progress";
const SEED_MARKER_FILE: &str = ".rushi-offline-seed.json";
const IMPORT_STAGING_DIR: &str = ".rushi-offline-import-staging";
const MAX_ZIP_ENTRIES: usize = 50_000;
const MAX_UNCOMPRESSED_BYTES: u64 = 3 * 1024 * 1024 * 1024;
const COPY_PROGRESS_CHUNK_BYTES: u64 = 8 * 1024 * 1024;
const COPY_IO_BUFFER_BYTES: usize = 1024 * 1024;
pub const OFFLINE_IMPORT_CANCELLED_MSG: &str = "离线包导入已取消。";

static IMPORT_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static IMPORT_CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);

/// True while another thread holds the offline pack import lock.
pub fn is_offline_asr_models_pack_import_in_progress() -> bool {
    matches!(import_lock().try_lock(), Err(TryLockError::WouldBlock))
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct OfflineAsrModelsPackImportResult {
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
pub struct OfflineAsrModelsPackProgressPayload {
    pub phase: String,
    pub copied_bytes: u64,
    pub total_bytes: u64,
    pub percent: u8,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct SeedMarker {
    pack_version: u32,
    bundle_id: String,
    #[serde(default)]
    /// Recorded for diagnostics; skip/reseed compares `pack_version` + `bundle_id` only.
    rushi_version: Option<String>,
    seeded_at: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubReleaseConfig {
    owner: String,
    repo: String,
}

const GITHUB_RELEASE_CONFIG: &str = include_str!("../../../../../resources/github-release.json");

fn import_lock() -> &'static Mutex<()> {
    IMPORT_LOCK.get_or_init(|| Mutex::new(()))
}

fn acquire_import_lock() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    match import_lock().try_lock() {
        Ok(guard) => Ok(guard),
        Err(TryLockError::WouldBlock) => {
            Err("已有离线包导入任务进行中，请稍候完成后再试。".to_string())
        }
        Err(TryLockError::Poisoned(_)) => {
            Err("离线包导入锁异常，请重启应用后再试。".to_string())
        }
    }
}

fn reset_import_cancel_flag() {
    IMPORT_CANCEL_REQUESTED.store(false, Ordering::SeqCst);
}

fn request_import_cancel() {
    IMPORT_CANCEL_REQUESTED.store(true, Ordering::SeqCst);
}

fn check_import_cancelled() -> Result<(), String> {
    if IMPORT_CANCEL_REQUESTED.load(Ordering::SeqCst) {
        Err(OFFLINE_IMPORT_CANCELLED_MSG.to_string())
    } else {
        Ok(())
    }
}

struct TempDirGuard(PathBuf);

impl TempDirGuard {
    fn new(path: PathBuf) -> Self {
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn into_path(mut self) -> PathBuf {
        let path = std::mem::take(&mut self.0);
        std::mem::forget(self);
        path
    }
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        if !self.0.as_os_str().is_empty() {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

fn cleanup_stale_extract_temp_dirs() {
    let Ok(temp_root) = std::env::temp_dir().read_dir() else {
        return;
    };
    for entry in temp_root.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("rushi-offline-asr-pack-") {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

fn safe_rel_path_under(base: &Path, rel: &str) -> Result<PathBuf, String> {
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

fn ensure_safe_copy_destination(dest: &Path) -> Result<(), String> {
    if dest.exists() {
        let meta = fs::symlink_metadata(dest).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("目标路径为符号链接，拒绝写入。".to_string());
        }
    }
    Ok(())
}

#[cfg(unix)]
fn zip_entry_is_symlink(entry: &zip::read::ZipFile<'_>) -> bool {
    entry
        .unix_mode()
        .map(|mode| mode & 0o170_000 == 0o120_000)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn zip_entry_is_symlink(_entry: &zip::read::ZipFile<'_>) -> bool {
    false
}

fn log_import_detail(app: Option<&AppHandle>, detail: &str) {
    let Some(app) = app else {
        return;
    };
    let _ = app.emit("offline-asr-models-pack-log", detail.to_string());
}

fn cleanup_stale_import_staging(models_root: &Path) {
    let staging_root = models_root.join(IMPORT_STAGING_DIR);
    if staging_root.is_dir() {
        let _ = fs::remove_dir_all(staging_root);
    }
}

fn rollback_new_files(paths: &[PathBuf], boundary: &Path) {
    for path in paths.iter().rev() {
        if path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
    let mut dirs: Vec<PathBuf> = paths
        .iter()
        .filter_map(|path| path.parent().map(|parent| parent.to_path_buf()))
        .collect();
    dirs.sort_by_key(|dir| std::cmp::Reverse(dir.components().count()));
    dirs.dedup();
    for dir in dirs {
        if !dir.starts_with(boundary) {
            continue;
        }
        let is_empty = dir
            .read_dir()
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);
        if is_empty {
            let _ = fs::remove_dir(&dir);
        }
    }
}

fn emit_progress(app: Option<&AppHandle>, phase: &str, copied_bytes: u64, total_bytes: u64) {
    let Some(app) = app else {
        return;
    };
    let percent = copied_bytes
        .checked_mul(100)
        .and_then(|scaled| scaled.checked_div(total_bytes))
        .map(|p| p.min(100) as u8)
        .unwrap_or(0);
    let _ = app.emit(
        OFFLINE_ASR_MODELS_PACK_PROGRESS_EVENT,
        OfflineAsrModelsPackProgressPayload {
            phase: phase.to_string(),
            copied_bytes,
            total_bytes,
            percent,
        },
    );
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

fn find_cached_model_dir(
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

fn validate_manifest_models_cached(
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
                "导入后仍缺少完整模型：{}（请确认离线包未损坏）。",
                spec.hub_id
            ));
        }
    }
    Ok(())
}

fn read_manifest_from_dir(root: &Path) -> Result<OfflineAsrModelsPackManifest, String> {
    let path = root.join("manifest.json");
    let body = fs::read_to_string(&path)
        .map_err(|e| format!("读取离线包 manifest 失败（{}）: {e}", path.display()))?;
    serde_json::from_str(&body).map_err(|e| format!("离线包 manifest 格式无效: {e}"))
}

fn read_seed_marker(models_root: &Path) -> Result<Option<SeedMarker>, String> {
    let path = models_root.join(SEED_MARKER_FILE);
    if !path.is_file() {
        return Ok(None);
    }
    let body = fs::read_to_string(&path)
        .map_err(|e| format!("读取 seed marker 失败: {e}"))?;
    serde_json::from_str(&body)
        .map(Some)
        .map_err(|e| format!("seed marker 格式无效: {e}"))
}

fn try_skip_reseed(
    models_root: &Path,
    modelscope_cache: &Path,
    manifest: &OfflineAsrModelsPackManifest,
    specs: &[ResolvedPackModelSpec],
) -> Result<Option<OfflineAsrModelsPackImportResult>, String> {
    let Some(marker) = read_seed_marker(models_root)? else {
        return Ok(None);
    };
    if marker.pack_version != manifest.pack_version || marker.bundle_id != manifest.bundle_id {
        return Ok(None);
    }
    validate_manifest_models_cached(modelscope_cache, specs)?;
    Ok(Some(OfflineAsrModelsPackImportResult {
        imported_bytes: 0,
        models_root: models_root.to_string_lossy().to_string(),
        modelscope_cache: modelscope_cache.to_string_lossy().to_string(),
        pack_version: manifest.pack_version,
        bundle_id: manifest.bundle_id.clone(),
        seeded_at: marker.seeded_at,
        skipped_reseed: true,
    }))
}

fn dir_file_bytes(root: &Path) -> Result<u64, String> {
    if !root.is_dir() {
        return Ok(0);
    }
    let mut total = 0_u64;
    for entry in fs::read_dir(root).map_err(|e| format!("读取目录失败: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err(format!(
                "离线包含符号链接（{}），请使用不含 symlink 的标准离线包。",
                path.display()
            ));
        }
        if meta.is_dir() {
            total = total.saturating_add(dir_file_bytes(&path)?);
        } else if meta.is_file() {
            total = total.saturating_add(meta.len());
        }
    }
    Ok(total)
}

fn extract_zip_to_temp(zip_path: &Path, app: Option<&AppHandle>) -> Result<PathBuf, String> {
    let file = File::open(zip_path).map_err(|e| format!("打开离线包失败: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("离线包不是有效 zip: {e}"))?;
    let temp_guard = TempDirGuard::new(std::env::temp_dir().join(format!(
        "rushi-offline-asr-pack-{}",
        uuid::Uuid::new_v4()
    )));
    let temp = temp_guard.path();
    fs::create_dir_all(temp).map_err(|e| format!("创建临时目录失败: {e}"))?;
    let total_entries = archive.len();
    if total_entries > MAX_ZIP_ENTRIES {
        return Err(format!(
            "离线包条目过多（{}，上限 {}）。",
            total_entries, MAX_ZIP_ENTRIES
        ));
    }
    let mut uncompressed_total = 0_u64;
    let total_entries_u64 = total_entries as u64;
    for i in 0..archive.len() {
        check_import_cancelled()?;
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("读取 zip 条目失败: {e}"))?;
        if zip_entry_is_symlink(&entry) {
            return Err(format!("离线包含符号链接: {}", entry.name()));
        }
        if !entry.is_dir() {
            uncompressed_total = uncompressed_total.saturating_add(entry.size());
            if uncompressed_total > MAX_UNCOMPRESSED_BYTES {
                return Err("离线包解压体积超过安全上限（3 GB）。".to_string());
            }
        }
        let Some(safe_rel) = sanitize_zip_entry_path(entry.name()) else {
            return Err(format!("离线包含非法路径: {}", entry.name()));
        };
        let out_path = temp.join(&safe_rel);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| format!("创建目录失败: {e}"))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
            }
            let mut out = File::create(&out_path).map_err(|e| format!("写入临时文件失败: {e}"))?;
            copy(&mut entry, &mut out).map_err(|e| format!("解压离线包失败: {e}"))?;
        }
        emit_progress(
            app,
            "extract",
            (i as u64).saturating_add(1),
            total_entries_u64.max(1),
        );
    }
    Ok(temp_guard.into_path())
}

fn sanitize_zip_entry_path(raw: &str) -> Option<PathBuf> {
    let path = Path::new(raw);
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

fn resolve_pack_root(source: &Path, app: Option<&AppHandle>) -> Result<(PathBuf, Option<PathBuf>), String> {
    if source.is_dir() {
        return Ok((source.to_path_buf(), None));
    }
    if source.is_file() {
        let temp = extract_zip_to_temp(source, app)?;
        return Ok((temp.clone(), Some(temp)));
    }
    Err(format!("离线包路径不存在: {}", source.display()))
}

struct CopyProgress<'a> {
    app: Option<&'a AppHandle>,
    phase: &'a str,
    copied: u64,
    total: u64,
}

impl CopyProgress<'_> {
    fn bump(&mut self, bytes: u64) -> Result<(), String> {
        self.copied = self.copied.saturating_add(bytes);
        emit_progress(self.app, self.phase, self.copied, self.total);
        Ok(())
    }
}

fn copy_file_with_progress(
    src: &Path,
    dest: &Path,
    file_size: u64,
    progress: &mut CopyProgress<'_>,
) -> Result<(), String> {
    check_import_cancelled()?;
    ensure_safe_copy_destination(dest)?;
    let mut src_file = File::open(src).map_err(|e| format!("打开源文件失败: {e}"))?;
    let mut dest_file = File::create(dest).map_err(|e| format!("创建目标文件失败: {e}"))?;
    let mut buf = vec![0_u8; COPY_IO_BUFFER_BYTES];
    let mut copied_in_file = 0_u64;
    let mut since_last_emit = 0_u64;
    loop {
        check_import_cancelled()?;
        let read = src_file
            .read(&mut buf)
            .map_err(|e| format!("读取源文件失败: {e}"))?;
        if read == 0 {
            break;
        }
        dest_file
            .write_all(&buf[..read])
            .map_err(|e| format!("写入目标文件失败: {e}"))?;
        copied_in_file = copied_in_file.saturating_add(read as u64);
        since_last_emit = since_last_emit.saturating_add(read as u64);
        if since_last_emit >= COPY_PROGRESS_CHUNK_BYTES || copied_in_file >= file_size {
            progress.bump(since_last_emit)?;
            since_last_emit = 0;
        }
    }
    if since_last_emit > 0 {
        progress.bump(since_last_emit)?;
    }
    Ok(())
}

fn copy_dir_recursive(
    src: &Path,
    dest: &Path,
    progress: &mut CopyProgress<'_>,
    rollback: &mut Vec<PathBuf>,
) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("离线包缺少目录: {}", src.display()));
    }
    if dest.exists() {
        let meta = fs::symlink_metadata(dest).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("目标路径为符号链接，拒绝写入。".to_string());
        }
    }
    fs::create_dir_all(dest).map_err(|e| format!("创建目录失败: {e}"))?;
    for entry in fs::read_dir(src).map_err(|e| format!("读取目录失败: {e}"))? {
        check_import_cancelled()?;
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        let meta = fs::symlink_metadata(&src_path).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("离线包含符号链接，请使用不含 symlink 的标准离线包。".to_string());
        }
        if meta.is_dir() {
            copy_dir_recursive(&src_path, &dest_path, progress, rollback)?;
        } else if meta.is_file() {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let existed = dest_path
                .exists()
                && fs::symlink_metadata(&dest_path)
                    .map(|m| !m.file_type().is_symlink())
                    .unwrap_or(false);
            copy_file_with_progress(&src_path, &dest_path, meta.len(), progress)?;
            if !existed {
                rollback.push(dest_path);
            }
        }
    }
    Ok(())
}

fn copy_modelscope_tree(
    source_root: &Path,
    dest_root: &Path,
    app: Option<&AppHandle>,
    phase: &str,
    rollback: &mut Vec<PathBuf>,
) -> Result<u64, String> {
    let src = source_root.join("modelscope");
    if !src.is_dir() {
        return Err("离线包缺少 modelscope/ 目录。".to_string());
    }
    let total = dir_file_bytes(&src)?;
    let mut progress = CopyProgress {
        app,
        phase,
        copied: 0,
        total: total.max(1),
    };
    copy_dir_recursive(&src, dest_root, &mut progress, rollback)?;
    Ok(progress.copied)
}

fn write_seed_marker(models_root: &Path, manifest: &OfflineAsrModelsPackManifest) -> Result<(), String> {
    let marker = models_root.join(SEED_MARKER_FILE);
    let body = json!({
        "pack_version": manifest.pack_version,
        "bundle_id": manifest.bundle_id,
        "rushi_version": manifest.rushi_version,
        "seeded_at": chrono::Local::now().to_rfc3339(),
    });
    let serialized = serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?;
    let tmp = marker.with_extension("json.tmp");
    fs::write(&tmp, serialized).map_err(|e| format!("写入 seed marker 失败: {e}"))?;
    fs::rename(&tmp, &marker).map_err(|e| format!("写入 seed marker 失败: {e}"))?;
    Ok(())
}

fn offline_pack_release_url(version: &str) -> Result<String, String> {
    let cfg: GithubReleaseConfig = serde_json::from_str(GITHUB_RELEASE_CONFIG)
        .map_err(|e| format!("读取 GitHub Release 配置失败: {e}"))?;
    Ok(format!(
        "https://github.com/{}/{}/releases/tag/v{version}",
        cfg.owner, cfg.repo
    ))
}

pub fn import_offline_asr_models_pack_at(
    models_root: &Path,
    source_path: &Path,
    app: Option<&AppHandle>,
) -> Result<OfflineAsrModelsPackImportResult, String> {
    let _guard = acquire_import_lock()?;
    reset_import_cancel_flag();
    cleanup_stale_extract_temp_dirs();
    let (pack_root, temp_cleanup) = resolve_pack_root(source_path, app)?;
    let staging_dir = models_root
        .join(IMPORT_STAGING_DIR)
        .join(uuid::Uuid::new_v4().to_string());
    let result = (|| {
        let manifest = read_manifest_from_dir(&pack_root)?;
        let specs = resolve_model_specs(&manifest)?;
        fs::create_dir_all(models_root).map_err(|e| format!("创建 models 目录失败: {e}"))?;
        let modelscope_cache = modelscope_cache_for_models_root(models_root);
        fs::create_dir_all(&modelscope_cache).map_err(|e| format!("创建 ModelScope 缓存失败: {e}"))?;

        cleanup_stale_import_staging(models_root);

        if let Some(skipped) = try_skip_reseed(models_root, &modelscope_cache, &manifest, &specs)? {
            return Ok(skipped);
        }

        emit_progress(app, "validate", 0, 1);
        fs::create_dir_all(&staging_dir).map_err(|e| format!("创建导入暂存目录失败: {e}"))?;
        let staging_modelscope = staging_dir.join("modelscope");
        let mut discard_rollback = Vec::new();
        let copied_to_staging = copy_modelscope_tree(
            &pack_root,
            &staging_modelscope,
            app,
            "copy",
            &mut discard_rollback,
        )?;
        validate_manifest_models_cached(&staging_modelscope, &specs)?;
        emit_progress(app, "merge", 0, 1);
        let mut merge_rollback = Vec::new();
        let merge_result = copy_modelscope_tree(
            &staging_dir,
            &modelscope_cache,
            app,
            "merge",
            &mut merge_rollback,
        );
        if let Err(err) = merge_result {
            rollback_new_files(&merge_rollback, &modelscope_cache);
            log_import_detail(app, &format!("ERROR offline_pack merge rollback: {err}"));
            return Err(err);
        }
        let merged_bytes = merge_result.unwrap_or(0);
        if let Err(err) = validate_manifest_models_cached(&modelscope_cache, &specs) {
            rollback_new_files(&merge_rollback, &modelscope_cache);
            log_import_detail(app, &format!("ERROR offline_pack validate rollback: {err}"));
            return Err(err);
        }
        write_seed_marker(models_root, &manifest)?;
        let seeded_at = chrono::Local::now().to_rfc3339();
        Ok(OfflineAsrModelsPackImportResult {
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
    if let Some(temp) = temp_cleanup {
        let _ = fs::remove_dir_all(temp);
    }
    result
}

#[tauri::command]
pub async fn import_offline_asr_models_pack(
    app: AppHandle,
    state: State<'_, DbState>,
    source_path: String,
) -> Result<OfflineAsrModelsPackImportResult, String> {
    let trimmed = source_path.trim();
    if trimmed.is_empty() {
        return Err("未指定离线包路径。".to_string());
    }
    let st = state.inner().clone();
    let path = trimmed.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let models_root = models_root_for_app_data_root(&st.root);
        import_offline_asr_models_pack_at(&models_root, Path::new(&path), Some(&app))
    })
    .await
    .map_err(|e| format!("导入任务失败: {e}"))?
}

#[tauri::command]
pub async fn pick_and_import_offline_asr_models_pack(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<Option<OfflineAsrModelsPackImportResult>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Rushi offline ASR models", &["zip"])
            .pick_file()
    })
    .await
    .map_err(|e| format!("选择文件失败: {e}"))?;
    let Some(path) = picked else {
        return Ok(None);
    };
    let st = state.inner().clone();
    let path_str = path.to_string_lossy().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let models_root = models_root_for_app_data_root(&st.root);
        import_offline_asr_models_pack_at(&models_root, Path::new(&path_str), Some(&app))
    })
    .await
    .map_err(|e| format!("导入任务失败: {e}"))?
    .map(Some)
}

#[tauri::command]
pub fn cancel_offline_asr_models_pack_import() -> Result<(), String> {
    if !is_offline_asr_models_pack_import_in_progress() {
        return Err("当前没有进行中的离线包导入。".to_string());
    }
    request_import_cancel();
    Ok(())
}

#[tauri::command]
pub async fn open_offline_asr_models_pack_release_page(app_version: String) -> Result<(), String> {
    let version = app_version.trim().trim_start_matches('v');
    if version.is_empty() {
        return Err("无法解析应用版本。".to_string());
    }
    let url = offline_pack_release_url(version)?;
    open_url_in_browser(&url)
}

fn open_url_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::offline_asr_models_pack_manifest::OfflineAsrModelsPackModelSpec;
    use std::io::Write;
    use std::sync::Mutex as TestSerialMutex;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    static TEST_SERIAL: TestSerialMutex<()> = TestSerialMutex::new(());

    use crate::local_asr_model::{
        DEFAULT_FUNASR_HUB_MODEL_ID, DEFAULT_FUNASR_PUNC_MODEL_ID, DEFAULT_FUNASR_VAD_MODEL_ID,
    };

    fn run_serial(test: impl FnOnce()) {
        let _guard = TEST_SERIAL.lock().unwrap_or_else(|e| e.into_inner());
        test();
    }

    fn temp_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("{prefix}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_manifest(root: &Path, manifest: &OfflineAsrModelsPackManifest) {
        fs::write(
            root.join("manifest.json"),
            serde_json::to_string_pretty(manifest).unwrap(),
        )
        .unwrap();
    }

    fn write_fake_model(root: &Path, hub_id: &str, weight_bytes: u64) {
        let parts: Vec<_> = hub_id.split('/').collect();
        let dir = root
            .join("modelscope/models")
            .join(parts[0])
            .join(parts[1]);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("config.yaml"), "model: test\n").unwrap();
        if hub_id == DEFAULT_FUNASR_HUB_MODEL_ID {
            fs::write(dir.join("tokens.json"), "[]").unwrap();
        }
        let mut weight = vec![0_u8; weight_bytes as usize];
        if let Some(byte) = weight.last_mut() {
            *byte = 1;
        }
        fs::write(dir.join("model.pt"), weight).unwrap();
    }

    fn triplet_manifest() -> OfflineAsrModelsPackManifest {
        OfflineAsrModelsPackManifest {
            pack_version: OFFLINE_ASR_MODELS_PACK_VERSION,
            bundle_id: DEFAULT_OFFLINE_ASR_BUNDLE_ID.to_string(),
            rushi_version: Some("0.0.0".to_string()),
            models: vec![
                OfflineAsrModelsPackModelSpec {
                    hub_id: DEFAULT_FUNASR_HUB_MODEL_ID.to_string(),
                    required_files: vec![
                        "model.pt".to_string(),
                        "config.yaml".to_string(),
                        "tokens.json".to_string(),
                    ],
                    min_weight_bytes: Some(8),
                },
                OfflineAsrModelsPackModelSpec {
                    hub_id: DEFAULT_FUNASR_VAD_MODEL_ID.to_string(),
                    required_files: vec!["model.pt".to_string()],
                    min_weight_bytes: Some(1),
                },
                OfflineAsrModelsPackModelSpec {
                    hub_id: DEFAULT_FUNASR_PUNC_MODEL_ID.to_string(),
                    required_files: vec!["model.pt".to_string(), "config.yaml".to_string()],
                    min_weight_bytes: Some(1),
                },
            ],
        }
    }

    #[test]
    fn import_pack_from_directory_seeds_modelscope_cache() {
        run_serial(|| {
            let pack = temp_dir("offline-pack-src");
            let dest_root = temp_dir("offline-pack-dest");
            let manifest = triplet_manifest();
            write_manifest(&pack, &manifest);
            write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 16);
            write_fake_model(&pack, DEFAULT_FUNASR_VAD_MODEL_ID, 4);
            write_fake_model(&pack, DEFAULT_FUNASR_PUNC_MODEL_ID, 4);

            let result = import_offline_asr_models_pack_at(&dest_root, &pack, None).unwrap();
            assert_eq!(result.bundle_id, DEFAULT_OFFLINE_ASR_BUNDLE_ID);
            assert!(result.imported_bytes > 0);
            assert!(!result.skipped_reseed);

            let ms = modelscope_cache_for_models_root(&dest_root);
            assert!(find_cached_model_dir(
                &ms,
                DEFAULT_FUNASR_HUB_MODEL_ID,
                &["model.pt".to_string(), "config.yaml".to_string(), "tokens.json".to_string()],
                8,
                "model.pt",
            )
            .is_some());
            assert!(dest_root.join(SEED_MARKER_FILE).is_file());

            let _ = fs::remove_dir_all(pack);
            let _ = fs::remove_dir_all(dest_root);
        });
    }

    #[test]
    fn skips_reimport_when_marker_and_models_complete() {
        run_serial(|| {
            let pack = temp_dir("offline-pack-skip-src");
            let dest_root = temp_dir("offline-pack-skip-dest");
            let manifest = triplet_manifest();
            write_manifest(&pack, &manifest);
            write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 16);
            write_fake_model(&pack, DEFAULT_FUNASR_VAD_MODEL_ID, 4);
            write_fake_model(&pack, DEFAULT_FUNASR_PUNC_MODEL_ID, 4);

            let first = import_offline_asr_models_pack_at(&dest_root, &pack, None).unwrap();
            assert!(first.imported_bytes > 0);

            let second = import_offline_asr_models_pack_at(&dest_root, &pack, None).unwrap();
            assert!(second.skipped_reseed);
            assert_eq!(second.imported_bytes, 0);
            assert!(!second.seeded_at.is_empty());

            let _ = fs::remove_dir_all(pack);
            let _ = fs::remove_dir_all(dest_root);
        });
    }

    #[test]
    fn rejects_zip_with_path_traversal() {
        run_serial(|| {
            let zip_path = temp_dir("offline-pack-bad").join("bad.zip");
            let file = File::create(&zip_path).unwrap();
            let mut zip = ZipWriter::new(file);
            zip.start_file("../evil.txt", SimpleFileOptions::default())
                .unwrap();
            zip.write_all(b"bad").unwrap();
            zip.finish().unwrap();

            let err = extract_zip_to_temp(&zip_path, None).unwrap_err();
            assert!(err.contains("非法路径"));

            let _ = fs::remove_dir_all(zip_path.parent().unwrap());
        });
    }

    #[test]
    fn rejects_unknown_bundle_id() {
        run_serial(|| {
            let pack = temp_dir("offline-pack-bad-bundle");
            let dest_root = temp_dir("offline-pack-bad-bundle-dest");
            let manifest = OfflineAsrModelsPackManifest {
                pack_version: OFFLINE_ASR_MODELS_PACK_VERSION,
                bundle_id: "other-bundle".to_string(),
                rushi_version: Some("0.0.0".to_string()),
                models: vec![OfflineAsrModelsPackModelSpec {
                    hub_id: DEFAULT_FUNASR_HUB_MODEL_ID.to_string(),
                    required_files: vec!["model.pt".to_string()],
                    min_weight_bytes: Some(1),
                }],
            };
            write_manifest(&pack, &manifest);
            write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 4);
            let err = import_offline_asr_models_pack_at(&dest_root, &pack, None).unwrap_err();
            assert!(err.contains("bundle_id"));
            let _ = fs::remove_dir_all(pack);
            let _ = fs::remove_dir_all(dest_root);
        });
    }

    #[test]
    fn default_manifest_lists_default_paraformer_triplet() {
        let manifest = default_offline_asr_models_pack_manifest("0.1.8");
        assert_eq!(manifest.models.len(), 3);
        assert_eq!(manifest.bundle_id, DEFAULT_OFFLINE_ASR_BUNDLE_ID);
    }

    #[test]
    fn rejects_parallel_import_while_lock_held() {
        run_serial(|| {
            let _guard = acquire_import_lock().unwrap();
            let dest_root = temp_dir("offline-pack-lock");
            let pack = temp_dir("offline-pack-lock-src");
            let manifest = triplet_manifest();
            write_manifest(&pack, &manifest);
            write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 4);
            let err = import_offline_asr_models_pack_at(&dest_root, &pack, None).unwrap_err();
            assert!(err.contains("导入任务进行中"));
            let _ = fs::remove_dir_all(pack);
            let _ = fs::remove_dir_all(dest_root);
        });
    }

    #[test]
    fn rejects_manifest_path_traversal_in_required_files() {
        run_serial(|| {
            let pack = temp_dir("offline-pack-bad-rel");
            let dest_root = temp_dir("offline-pack-bad-rel-dest");
            let mut manifest = triplet_manifest();
            manifest.models[0].required_files = vec!["../escape.pt".to_string()];
            write_manifest(&pack, &manifest);
            write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 16);
            let err = import_offline_asr_models_pack_at(&dest_root, &pack, None).unwrap_err();
            assert!(err.contains("非法路径") || err.contains("无效"));
            let _ = fs::remove_dir_all(pack);
            let _ = fs::remove_dir_all(dest_root);
        });
    }

    #[test]
    fn rejects_preexisting_symlink_destination() {
        run_serial(|| {
            let pack = temp_dir("offline-pack-symlink-dest");
            let dest_root = temp_dir("offline-pack-symlink-dest-root");
            let manifest = triplet_manifest();
            write_manifest(&pack, &manifest);
            write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 16);
            write_fake_model(&pack, DEFAULT_FUNASR_VAD_MODEL_ID, 4);
            write_fake_model(&pack, DEFAULT_FUNASR_PUNC_MODEL_ID, 4);

            let ms = modelscope_cache_for_models_root(&dest_root);
            let hub_parts: Vec<_> = DEFAULT_FUNASR_HUB_MODEL_ID.split('/').collect();
            let target_dir = ms
                .join("models")
                .join(hub_parts[0])
                .join(hub_parts[1]);
            fs::create_dir_all(target_dir.parent().unwrap()).unwrap();
            let trap = dest_root.join("trap.txt");
            fs::write(&trap, b"trap").unwrap();
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(&trap, &target_dir).unwrap();
                let err = import_offline_asr_models_pack_at(&dest_root, &pack, None).unwrap_err();
                assert!(err.contains("符号链接"));
            }

            let _ = fs::remove_dir_all(pack);
            let _ = fs::remove_dir_all(dest_root);
        });
    }
}

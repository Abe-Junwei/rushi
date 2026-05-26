use super::integrity::{inspect_installed_runtime, local_runtime_root, version_dir, write_marker};
use super::manifest::{current_platform_key, parse_manifest, select_asr_sidecar_component};
use crate::DbState;
use futures_util::StreamExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use zip::ZipArchive;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeInstallProgress {
    pub phase: String,
    pub message: String,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub version: Option<String>,
    pub error: Option<String>,
}

impl Default for LocalRuntimeInstallProgress {
    fn default() -> Self {
        Self {
            phase: "idle".into(),
            message: String::new(),
            downloaded_bytes: None,
            total_bytes: None,
            version: None,
            error: None,
        }
    }
}

struct InstallerStateInner {
    progress: LocalRuntimeInstallProgress,
    cancel: Option<Arc<AtomicBool>>,
}

impl Default for InstallerStateInner {
    fn default() -> Self {
        Self {
            progress: LocalRuntimeInstallProgress::default(),
            cancel: None,
        }
    }
}

pub struct LocalRuntimeInstallerState(Mutex<InstallerStateInner>);

impl Default for LocalRuntimeInstallerState {
    fn default() -> Self {
        Self(Mutex::new(InstallerStateInner::default()))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeDownloadResult {
    pub started: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

fn update_progress(
    handle: &AppHandle,
    phase: &str,
    message: impl Into<String>,
    version: Option<String>,
    downloaded_bytes: Option<u64>,
    total_bytes: Option<u64>,
    error: Option<String>,
) {
    let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() else {
        return;
    };
    let lock = state.0.lock();
    if let Ok(mut guard) = lock {
        guard.progress = LocalRuntimeInstallProgress {
            phase: phase.to_string(),
            message: message.into(),
            downloaded_bytes,
            total_bytes,
            version,
            error,
        };
    }
}

fn append_runtime_log_line(handle: &AppHandle, line: &str) {
    if let Some(st) = handle.try_state::<DbState>() {
        crate::project::utils::append_desktop_log_line(&st, line);
    }
}

pub fn install_progress(handle: &AppHandle) -> LocalRuntimeInstallProgress {
    handle
        .try_state::<LocalRuntimeInstallerState>()
        .and_then(|state| state.0.lock().ok().map(|guard| guard.progress.clone()))
        .unwrap_or_default()
}

fn manifest_source_from_env() -> Option<String> {
    let raw = std::env::var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL").ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn is_http_source(source: &str) -> bool {
    source.strip_prefix("http://").is_some() || source.strip_prefix("https://").is_some()
}

fn read_text_source(source: &str) -> Result<String, String> {
    if is_http_source(source) {
        return tauri::async_runtime::block_on(async move {
            let resp = reqwest::Client::new()
                .get(source)
                .send()
                .await
                .map_err(|e| format!("manifest_fetch_failed: {e}"))?;
            if !resp.status().is_success() {
                return Err(format!("manifest_http_{}", resp.status().as_u16()));
            }
            resp.text()
                .await
                .map_err(|e| format!("manifest_read_failed: {e}"))
        });
    }
    let path = source.strip_prefix("file://").unwrap_or(source);
    fs::read_to_string(path).map_err(|e| format!("manifest_read_failed: {e}"))
}

fn sha256_hex(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("open_download_failed: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0_u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("hash_read_failed: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn ensure_not_cancelled(cancel: &Arc<AtomicBool>) -> Result<(), String> {
    if cancel.load(Ordering::SeqCst) {
        Err("cancelled".into())
    } else {
        Ok(())
    }
}

fn download_to_path(
    handle: &AppHandle,
    url: &str,
    target: &Path,
    cancel: &Arc<AtomicBool>,
    version: &str,
) -> Result<(), String> {
    ensure_not_cancelled(cancel)?;
    if is_http_source(url) {
        let url_owned = url.to_string();
        let target_path = target.to_path_buf();
        let cancel_flag = cancel.clone();
        return tauri::async_runtime::block_on(async move {
            let resp = reqwest::Client::new()
                .get(&url_owned)
                .send()
                .await
                .map_err(|e| format!("artifact_fetch_failed: {e}"))?;
            if !resp.status().is_success() {
                return Err(format!("artifact_http_{}", resp.status().as_u16()));
            }
            let total = resp.content_length();
            let mut file =
                File::create(&target_path).map_err(|e| format!("artifact_create_failed: {e}"))?;
            let mut stream = resp.bytes_stream();
            let mut downloaded = 0_u64;
            while let Some(chunk) = stream.next().await {
                if cancel_flag.load(Ordering::SeqCst) {
                    return Err("cancelled".into());
                }
                let chunk = chunk.map_err(|e| format!("artifact_stream_failed: {e}"))?;
                file.write_all(&chunk)
                    .map_err(|e| format!("artifact_write_failed: {e}"))?;
                downloaded = downloaded.saturating_add(chunk.len() as u64);
                update_progress(
                    handle,
                    "downloading",
                    "正在下载本机语音识别组件…",
                    Some(version.to_string()),
                    Some(downloaded),
                    total,
                    None,
                );
            }
            Ok(())
        });
    }

    let source_path = PathBuf::from(url.strip_prefix("file://").unwrap_or(url));
    let total = fs::metadata(&source_path)
        .map_err(|e| format!("artifact_stat_failed: {e}"))?
        .len();
    let mut src = File::open(&source_path).map_err(|e| format!("artifact_open_failed: {e}"))?;
    let mut dst = File::create(target).map_err(|e| format!("artifact_create_failed: {e}"))?;
    let mut copied = 0_u64;
    let mut buf = vec![0_u8; 1024 * 1024];
    loop {
        ensure_not_cancelled(cancel)?;
        let n = src
            .read(&mut buf)
            .map_err(|e| format!("artifact_read_failed: {e}"))?;
        if n == 0 {
            break;
        }
        dst.write_all(&buf[..n])
            .map_err(|e| format!("artifact_write_failed: {e}"))?;
        copied = copied.saturating_add(n as u64);
        update_progress(
            handle,
            "downloading",
            "正在复制本机语音识别组件…",
            Some(version.to_string()),
            Some(copied),
            Some(total),
            None,
        );
    }
    Ok(())
}

fn extract_zip(zip_path: &Path, dest: &Path, cancel: &Arc<AtomicBool>) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("create_extract_dir_failed: {e}"))?;
    let file = File::open(zip_path).map_err(|e| format!("open_zip_failed: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("open_zip_failed: {e}"))?;
    for i in 0..archive.len() {
        ensure_not_cancelled(cancel)?;
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("read_zip_entry_failed: {e}"))?;
        let Some(rel) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            return Err("zip_path_traversal".into());
        };
        let out_path = dest.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| format!("create_dir_failed: {e}"))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create_dir_failed: {e}"))?;
        }
        let mut out = File::create(&out_path).map_err(|e| format!("create_file_failed: {e}"))?;
        std::io::copy(&mut entry, &mut out).map_err(|e| format!("extract_file_failed: {e}"))?;
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(mode));
        }
    }
    Ok(())
}

fn reset_cancel_handle(handle: &AppHandle) {
    if let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() {
        if let Ok(mut guard) = state.0.lock() {
            guard.cancel = None;
        }
    }
}

fn run_install(handle: &AppHandle, app_root: &Path, cancel: Arc<AtomicBool>) -> Result<(), String> {
    let Some(source) = manifest_source_from_env() else {
        return Err("local_runtime_manifest_missing".into());
    };
    update_progress(
        handle,
        "downloading",
        "正在读取本机语音识别组件 manifest…",
        None,
        None,
        None,
        None,
    );
    let manifest_text = read_text_source(&source)?;
    let manifest = parse_manifest(&manifest_text)?;
    let platform = current_platform_key();
    let component = select_asr_sidecar_component(&manifest, &platform)
        .ok_or_else(|| format!("local_runtime_component_missing:{platform}"))?;
    let root = local_runtime_root(app_root);
    fs::create_dir_all(&root).map_err(|e| format!("create_local_runtime_root_failed: {e}"))?;
    let tmp_zip = root.join(format!("download-{}.zip.part", Uuid::new_v4()));
    let staging = root.join(format!("staging-{}", Uuid::new_v4()));
    let install_dir = version_dir(app_root, &component.version);
    download_to_path(handle, &component.url, &tmp_zip, &cancel, &component.version)?;
    ensure_not_cancelled(&cancel)?;
    let actual_sha = sha256_hex(&tmp_zip)?;
    if !component.sha256.trim().is_empty() && actual_sha != component.sha256.to_lowercase() {
        let _ = fs::remove_file(&tmp_zip);
        return Err("local_runtime_sha256_mismatch".into());
    }
    update_progress(
        handle,
        "installing",
        "正在解压并校验本机语音识别组件…",
        Some(component.version.clone()),
        None,
        None,
        None,
    );
    let _ = fs::remove_dir_all(&staging);
    extract_zip(&tmp_zip, &staging, &cancel)?;
    let _ = fs::remove_file(&tmp_zip);
    let _ = fs::remove_dir_all(&install_dir);
    fs::rename(&staging, &install_dir).map_err(|e| format!("promote_runtime_failed: {e}"))?;
    write_marker(app_root, &component.version, &component.exe_relpath)?;
    let info = inspect_installed_runtime(app_root);
    match info.status {
        super::integrity::InstalledRuntimeStatus::Installed => {
            update_progress(
                handle,
                "installed",
                "本机语音识别组件已安装完成。",
                Some(component.version.clone()),
                None,
                None,
                None,
            );
            append_runtime_log_line(
                handle,
                &format!("INFO local_runtime_installed version={}", component.version),
            );
            Ok(())
        }
        _ => Err(info.detail.unwrap_or_else(|| "local_runtime_install_corrupt".into())),
    }
}

#[tauri::command]
pub fn local_runtime_download_sidecar(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<LocalRuntimeDownloadResult, String> {
    let Some(installer) = app.try_state::<LocalRuntimeInstallerState>() else {
        return Err("local_runtime_state_missing".into());
    };
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let Ok(mut guard) = installer.0.lock() else {
            return Err("local_runtime_state_poisoned".into());
        };
        if matches!(guard.progress.phase.as_str(), "downloading" | "installing") {
            return Ok(LocalRuntimeDownloadResult {
                started: false,
                reason: Some("already_running".into()),
            });
        }
        guard.cancel = Some(cancel_flag.clone());
        guard.progress = LocalRuntimeInstallProgress {
            phase: "downloading".into(),
            message: "正在准备下载本机语音识别组件…".into(),
            downloaded_bytes: None,
            total_bytes: None,
            version: None,
            error: None,
        };
    }

    let app_root = state.inner().root.clone();
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = tauri::async_runtime::spawn_blocking(move || run_install(&handle, &app_root, cancel_flag))
            .await
            .map_err(|e| e.to_string())
            .and_then(|r| r);
        if let Err(err) = result {
            if err == "cancelled" {
                update_progress(
                    &app,
                    "cancelled",
                    "已取消本机语音识别组件下载。",
                    None,
                    None,
                    None,
                    None,
                );
                append_runtime_log_line(&app, "INFO local_runtime_cancelled");
            } else {
                update_progress(
                    &app,
                    "error",
                    "本机语音识别组件安装失败。",
                    None,
                    None,
                    None,
                    Some(err.clone()),
                );
                append_runtime_log_line(&app, &format!("ERROR local_runtime_install_failed {err}"));
            }
        }
        reset_cancel_handle(&app);
    });

    Ok(LocalRuntimeDownloadResult {
        started: true,
        reason: None,
    })
}

#[tauri::command]
pub fn local_runtime_cancel_download(app: AppHandle) -> Result<bool, String> {
    let Some(installer) = app.try_state::<LocalRuntimeInstallerState>() else {
        return Err("local_runtime_state_missing".into());
    };
    let Ok(guard) = installer.0.lock() else {
        return Err("local_runtime_state_poisoned".into());
    };
    if let Some(cancel) = &guard.cancel {
        cancel.store(true, Ordering::SeqCst);
        return Ok(true);
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::sha256_hex;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn sha256_hex_matches_known_value() {
        let temp = std::env::temp_dir().join(format!("rushi-local-runtime-hash-{}", Uuid::new_v4()));
        fs::write(&temp, b"abc").unwrap();
        let digest = sha256_hex(&temp).unwrap();
        assert_eq!(
            digest,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        let _ = fs::remove_file(&temp);
    }
}

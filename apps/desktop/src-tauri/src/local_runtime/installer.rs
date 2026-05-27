use super::catalog::load_configured_manifest;
use super::install_support::{
    disk_free_bytes, download_component_artifact, ensure_not_cancelled, extract_zip, sha256_hex,
    verify_installed_runtime,
};
use super::integrity::{
    inspect_installed_runtime, local_runtime_root, read_marker, version_dir,
    write_marker_with_previous, InstalledRuntimeMarker,
};
use super::manifest::{
    current_platform_key, is_shell_version_compatible, select_asr_sidecar_component,
};
use crate::DbState;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

const INSTALL_DISK_HEADROOM_BYTES: u64 = 512 * 1024 * 1024;

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

#[derive(Default)]
pub(super) struct InstallerStateInner {
    pub(super) progress: LocalRuntimeInstallProgress,
    pub(super) cancel: Option<Arc<AtomicBool>>,
}

pub struct LocalRuntimeInstallerState(pub(super) Mutex<InstallerStateInner>);

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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeActionResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

pub(super) fn install_phase_running(phase: &str) -> bool {
    matches!(phase, "downloading" | "installing" | "verifying")
}

pub(super) fn update_progress(
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

pub(super) fn append_runtime_log_line(handle: &AppHandle, line: &str) {
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

pub(super) fn reset_cancel_handle(handle: &AppHandle) {
    if let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() {
        if let Ok(mut guard) = state.0.lock() {
            guard.cancel = None;
        }
    }
}

pub(super) fn set_cancel_handle(handle: &AppHandle, cancel: Arc<AtomicBool>) -> Result<(), String> {
    let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() else {
        return Err("local_runtime_state_missing".into());
    };
    let Ok(mut guard) = state.0.lock() else {
        return Err("local_runtime_state_poisoned".into());
    };
    guard.cancel = Some(cancel);
    Ok(())
}

fn required_install_bytes(component_size: Option<u64>) -> Option<u64> {
    component_size.map(|size| {
        size.saturating_mul(3)
            .saturating_add(INSTALL_DISK_HEADROOM_BYTES)
    })
}

fn ensure_install_disk_budget(app_root: &Path, artifact_size: Option<u64>) -> Result<(), String> {
    let Some(required_bytes) = required_install_bytes(artifact_size) else {
        return Ok(());
    };
    let Some(free_bytes) = disk_free_bytes(&local_runtime_root(app_root)) else {
        return Ok(());
    };
    if free_bytes < required_bytes {
        return Err(format!(
            "local_runtime_disk_space_low:{free_bytes}:{required_bytes}"
        ));
    }
    Ok(())
}

fn previous_marker_for_install<'a>(
    existing_marker: Option<&'a InstalledRuntimeMarker>,
    installing_version: &str,
) -> Option<(&'a str, &'a str)> {
    existing_marker.and_then(|marker| {
        if marker.version != installing_version {
            Some((marker.version.as_str(), marker.exe_relpath.as_str()))
        } else {
            marker
                .previous_version
                .as_deref()
                .zip(marker.previous_exe_relpath.as_deref())
        }
    })
}

fn run_install(handle: &AppHandle, app_root: &Path, cancel: Arc<AtomicBool>) -> Result<(), String> {
    update_progress(
        handle,
        "downloading",
        "正在读取本机语音识别组件 manifest…",
        None,
        None,
        None,
        None,
    );
    let loaded = load_configured_manifest()?;
    let signature_key_id = loaded.signature_key_id.clone();
    let manifest_source = loaded.source.clone();
    let manifest = loaded.manifest;
    let platform = current_platform_key();
    let component = select_asr_sidecar_component(&manifest, &platform)
        .ok_or_else(|| format!("local_runtime_component_missing:{platform}"))?;
    if let Some(min_shell_version) = component.min_shell_version.as_deref() {
        if !is_shell_version_compatible(env!("CARGO_PKG_VERSION"), min_shell_version) {
            return Err(format!(
                "local_runtime_shell_version_incompatible:{}:{}",
                env!("CARGO_PKG_VERSION"),
                min_shell_version
            ));
        }
    }
    let root = local_runtime_root(app_root);
    fs::create_dir_all(&root).map_err(|e| format!("create_local_runtime_root_failed: {e}"))?;
    ensure_install_disk_budget(app_root, component.size_bytes)?;
    let tmp_zip = root.join(format!("download-{}.zip.part", Uuid::new_v4()));
    let staging = root.join(format!("staging-{}", Uuid::new_v4()));
    let install_dir = version_dir(app_root, &component.version);
    let existing_marker = read_marker(app_root).ok().filter(|_| {
        inspect_installed_runtime(app_root).status
            == super::integrity::InstalledRuntimeStatus::Installed
    });
    download_component_artifact(handle, component, &tmp_zip, &cancel)?;
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
    let staged_exe = staging.join(&component.exe_relpath);
    if !staged_exe.is_file() {
        let _ = fs::remove_dir_all(&staging);
        return Err("local_runtime_executable_missing".into());
    }
    update_progress(
        handle,
        "verifying",
        "正在验证本机语音识别组件可用性…",
        Some(component.version.clone()),
        None,
        None,
        None,
    );
    let models_root = app_root.join("models");
    if let Err(err) = verify_installed_runtime(&staged_exe, Some(&models_root), Some(&cancel)) {
        let _ = fs::remove_dir_all(&staging);
        return Err(err);
    }
    let backup_dir = if install_dir.exists() {
        let backup = root.join(format!("rollback-{}", Uuid::new_v4()));
        fs::rename(&install_dir, &backup).map_err(|e| format!("backup_runtime_failed: {e}"))?;
        Some(backup)
    } else {
        None
    };
    if let Err(err) = fs::rename(&staging, &install_dir) {
        if let Some(backup) = &backup_dir {
            let _ = fs::rename(backup, &install_dir);
        }
        return Err(format!("promote_runtime_failed: {err}"));
    }
    let installed_exe = install_dir.join(&component.exe_relpath);
    if !installed_exe.is_file() {
        let _ = fs::remove_dir_all(&install_dir);
        if let Some(backup) = &backup_dir {
            let _ = fs::rename(backup, &install_dir);
        }
        return Err("local_runtime_executable_missing".into());
    }
    if let Err(err) = write_marker_with_previous(
        app_root,
        &component.version,
        &component.exe_relpath,
        previous_marker_for_install(existing_marker.as_ref(), &component.version),
        Some("ready"),
    ) {
        let _ = fs::remove_dir_all(&install_dir);
        if let Some(backup) = &backup_dir {
            let _ = fs::rename(backup, &install_dir);
        }
        return Err(err);
    }
    let info = inspect_installed_runtime(app_root);
    match info.status {
        super::integrity::InstalledRuntimeStatus::Installed => {
            if let Some(backup) = backup_dir {
                let _ = fs::remove_dir_all(backup);
            }
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
                &format!(
                    "INFO local_runtime_installed version={} signature_key={} source={}",
                    component.version, signature_key_id, manifest_source
                ),
            );
            Ok(())
        }
        _ => {
            if let Some(backup) = &backup_dir {
                let _ = fs::remove_dir_all(&install_dir);
                let _ = fs::rename(backup, &install_dir);
            }
            Err(info
                .detail
                .unwrap_or_else(|| "local_runtime_install_corrupt".into()))
        }
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
        if install_phase_running(&guard.progress.phase) {
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
        let result = tauri::async_runtime::spawn_blocking(move || {
            run_install(&handle, &app_root, cancel_flag)
        })
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
                let failed_version = install_progress(&app).version;
                update_progress(
                    &app,
                    "error",
                    "本机语音识别组件安装失败。",
                    failed_version,
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
    use super::{install_phase_running, previous_marker_for_install};
    use crate::local_runtime::integrity::InstalledRuntimeMarker;

    #[test]
    fn install_phase_running_treats_verifying_as_busy() {
        assert!(install_phase_running("downloading"));
        assert!(install_phase_running("installing"));
        assert!(install_phase_running("verifying"));
        assert!(!install_phase_running("idle"));
        assert!(!install_phase_running("installed"));
        assert!(!install_phase_running("error"));
    }

    #[test]
    fn previous_marker_for_install_preserves_previous_on_same_version_reinstall() {
        let marker = InstalledRuntimeMarker {
            version: "0.2.0".into(),
            exe_relpath: "rushi-asr-sidecar/rushi-asr-sidecar".into(),
            verify_state: Some("ok".into()),
            previous_version: Some("0.1.0".into()),
            previous_exe_relpath: Some("rushi-asr-sidecar/rushi-asr-sidecar".into()),
            last_verify_error: None,
            last_install_phase: Some("ready".into()),
        };

        let previous = previous_marker_for_install(Some(&marker), "0.2.0");
        assert_eq!(
            previous,
            Some(("0.1.0", "rushi-asr-sidecar/rushi-asr-sidecar"))
        );
    }
}

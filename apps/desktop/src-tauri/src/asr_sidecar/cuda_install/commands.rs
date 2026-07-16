use super::paths::{cuda_sidecar_install_dir, read_cuda_installed_version};
use super::progress::{
    append_cuda_log_line, cuda_install_phase_running, cuda_install_progress, reset_cuda_cancel_handle,
    update_cuda_progress,
};
use super::run::run_cuda_install;
use super::types::{AsrCudaDownloadResult, AsrCudaInstallerState, AsrCudaSidecarStatus};
use crate::asr_sidecar::candidates::{
    app_data_cuda_sidecar_present, windows_nvidia_probe_ok,
};
use crate::local_runtime::catalog::{configured_manifest_source, load_configured_manifest};
use crate::local_runtime::manifest::{
    current_platform_key, is_shell_version_compatible, select_asr_sidecar_cuda_component,
};
use crate::DbState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

fn platform_supports_cuda_cdn() -> bool {
    cfg!(target_os = "windows") && cfg!(target_arch = "x86_64")
}

fn validate_cuda_exe(app_root: &std::path::Path) -> bool {
    let exe = cuda_sidecar_install_dir(app_root).join("rushi-asr-sidecar-cuda.exe");
    if !exe.is_file() {
        return false;
    }
    std::fs::metadata(&exe)
        .map(|m| m.len() > 1024)
        .unwrap_or(false)
}

/// Probe CUDA component availability without requiring `asr-sidecar` in the same manifest.
fn probe_cuda_manifest() -> (bool, Option<String>) {
    if configured_manifest_source().is_none() {
        return (false, None);
    }
    match load_configured_manifest() {
        Ok(loaded) => {
            let platform = current_platform_key();
            match select_asr_sidecar_cuda_component(&loaded.manifest, &platform) {
                Some(component) => {
                    if let Some(min_shell_version) = component.min_shell_version.as_deref() {
                        if !is_shell_version_compatible(env!("CARGO_PKG_VERSION"), min_shell_version)
                        {
                            return (
                                true,
                                Some(format!(
                                    "asr_cuda_shell_version_incompatible:{}:{}",
                                    env!("CARGO_PKG_VERSION"),
                                    min_shell_version
                                )),
                            );
                        }
                    }
                    (true, None)
                }
                None => (true, Some(format!("asr_cuda_component_missing:{platform}"))),
            }
        }
        Err(err) => (true, Some(err)),
    }
}

#[tauri::command]
pub fn asr_cuda_sidecar_status(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<AsrCudaSidecarStatus, String> {
    let platform_supported = platform_supports_cuda_cdn();
    let nvidia_detected = windows_nvidia_probe_ok();
    let mut cuda_installed =
        app_data_cuda_sidecar_present(&state.root) || validate_cuda_exe(&state.root);
    let resource_cuda = crate::asr_sidecar::candidates::resource_cuda_sidecar_present(&app);
    cuda_installed = cuda_installed || resource_cuda;

    let (manifest_configured, manifest_issue) = probe_cuda_manifest();
    let installed_version = read_cuda_installed_version(&state.root);

    let recommend_download = platform_supported
        && nvidia_detected
        && !cuda_installed
        && manifest_configured
        && manifest_issue.is_none();

    Ok(AsrCudaSidecarStatus {
        platform_supported,
        nvidia_detected,
        cuda_installed,
        manifest_configured,
        recommend_download,
        manifest_issue,
        installed_version,
        install: cuda_install_progress(&app),
    })
}

#[tauri::command]
pub fn asr_download_cuda_sidecar(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<AsrCudaDownloadResult, String> {
    if !platform_supports_cuda_cdn() {
        return Ok(AsrCudaDownloadResult {
            started: false,
            reason: Some("platform_unsupported".into()),
        });
    }
    if let Some(reason) = crate::local_runtime::installer::progress::refuse_cuda_start_reason(
        crate::local_runtime::installer::progress::lrc_install_active(&app),
    ) {
        // Shares the LRC download/progress helpers; refuse to start until that
        // install finishes so progress updates aren't misrouted between the two.
        return Ok(AsrCudaDownloadResult {
            started: false,
            reason: Some(reason.into()),
        });
    }
    let Some(installer) = app.try_state::<AsrCudaInstallerState>() else {
        return Err("asr_cuda_state_missing".into());
    };
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let Ok(mut guard) = installer.0.lock() else {
            return Err("asr_cuda_state_poisoned".into());
        };
        if cuda_install_phase_running(&guard.progress.phase) {
            return Ok(AsrCudaDownloadResult {
                started: false,
                reason: Some("already_running".into()),
            });
        }
        guard.cancel = Some(cancel_flag.clone());
        guard.progress = super::types::AsrCudaInstallProgress {
            phase: "downloading".into(),
            message: "正在准备下载 GPU 加速组件…".into(),
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
            run_cuda_install(&handle, &app_root, cancel_flag)
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);
        if let Err(err) = result {
            if err == "cancelled" {
                update_cuda_progress(
                    &app,
                    "cancelled",
                    "已取消 GPU 组件下载；下次可从断点续传。",
                    None,
                    None,
                    None,
                    None,
                );
                append_cuda_log_line(&app, "INFO asr_cuda_cancelled");
            } else {
                let failed_version = cuda_install_progress(&app).version;
                update_cuda_progress(
                    &app,
                    "error",
                    "GPU 加速组件安装失败；将继续使用 CPU 转写。",
                    failed_version,
                    None,
                    None,
                    Some(err.clone()),
                );
                append_cuda_log_line(&app, &format!("ERROR asr_cuda_install_failed {err}"));
            }
        }
        reset_cuda_cancel_handle(&app);
    });

    Ok(AsrCudaDownloadResult {
        started: true,
        reason: None,
    })
}

#[tauri::command]
pub fn asr_cancel_cuda_sidecar_download(app: AppHandle) -> Result<bool, String> {
    let Some(installer) = app.try_state::<AsrCudaInstallerState>() else {
        return Err("asr_cuda_state_missing".into());
    };
    let Ok(guard) = installer.0.lock() else {
        return Err("asr_cuda_state_poisoned".into());
    };
    if let Some(cancel) = guard.cancel.as_ref() {
        cancel.store(true, Ordering::SeqCst);
        Ok(true)
    } else {
        Ok(false)
    }
}

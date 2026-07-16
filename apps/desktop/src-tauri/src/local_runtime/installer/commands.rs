use super::progress::{
    append_runtime_log_line, cuda_install_active, install_phase_running, install_progress,
    reset_cancel_handle, update_progress,
};
use super::run::run_install;
use super::types::{LocalRuntimeDownloadResult, LocalRuntimeInstallerState};
use crate::local_runtime::recovery::run_auto_health_rollback;
use crate::DbState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub fn local_runtime_download_sidecar(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<LocalRuntimeDownloadResult, String> {
    let Some(installer) = app.try_state::<LocalRuntimeInstallerState>() else {
        return Err("local_runtime_state_missing".into());
    };
    if let Some(reason) = super::progress::refuse_lrc_start_reason(cuda_install_active(&app)) {
        // CUDA CDN install reuses this module's download/progress helpers; running both
        // at once would let their progress updates clobber each other's UI state.
        return Ok(LocalRuntimeDownloadResult {
            started: false,
            reason: Some(reason.into()),
        });
    }
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
        guard.progress = super::types::LocalRuntimeInstallProgress {
            phase: "downloading".into(),
            message: "正在准备下载本机语音识别组件…".into(),
            downloaded_bytes: None,
            total_bytes: None,
            version: None,
            error: None,
        };
    }

    let app_root = state.inner().root.clone();
    let app_root_for_rollback = app_root.clone();
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
                    "已取消下载；已保存进度，下次将从断点续传。",
                    None,
                    None,
                    None,
                    None,
                );
                append_runtime_log_line(&app, "INFO local_runtime_cancelled");
            } else if err.starts_with("local_runtime_verify_") {
                let failed_version = install_progress(&app).version;
                let cancel_flag = Arc::new(AtomicBool::new(false));
                if let Ok(restored) = run_auto_health_rollback(
                    &app_root_for_rollback,
                    &cancel_flag,
                    &err,
                    failed_version.as_deref(),
                ) {
                    update_progress(
                        &app,
                        "installed",
                        format!("新版本安装验证失败，已自动恢复上一版本（{restored}）。"),
                        Some(restored.clone()),
                        None,
                        None,
                        None,
                    );
                    append_runtime_log_line(
                        &app,
                        &format!("INFO local_runtime_auto_rollback version={restored}"),
                    );
                } else {
                    update_progress(
                        &app,
                        "error",
                        "本机语音识别组件安装失败。",
                        failed_version,
                        None,
                        None,
                        Some(err.clone()),
                    );
                    append_runtime_log_line(
                        &app,
                        &format!("ERROR local_runtime_install_failed {err}"),
                    );
                }
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

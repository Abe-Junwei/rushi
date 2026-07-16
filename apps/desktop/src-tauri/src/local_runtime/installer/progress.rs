use super::types::{LocalRuntimeInstallProgress, LocalRuntimeInstallerState};
use crate::DbState;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub(crate) fn install_phase_running(phase: &str) -> bool {
    matches!(phase, "downloading" | "installing" | "verifying")
}

/// Pure busy check for CUDA installer state (cancel handle + running phase).
/// Used by start-command mutual exclusion and by progress routing.
pub(crate) fn cuda_install_busy(cancel_set: bool, phase: &str) -> bool {
    cancel_set && install_phase_running(phase)
}

/// Refuse starting LRC download while CUDA CDN install is mid-flight.
pub(crate) fn refuse_lrc_start_reason(cuda_busy: bool) -> Option<&'static str> {
    cuda_busy.then_some("cuda_download_running")
}

/// Refuse starting CUDA download while LRC install is mid-flight.
pub(crate) fn refuse_cuda_start_reason(lrc_busy: bool) -> Option<&'static str> {
    lrc_busy.then_some("lrc_download_running")
}

pub(crate) fn cuda_install_active(handle: &AppHandle) -> bool {
    let Some(cuda) = handle.try_state::<crate::asr_sidecar::cuda_install::AsrCudaInstallerState>()
    else {
        return false;
    };
    let Ok(guard) = cuda.0.lock() else {
        return false;
    };
    cuda_install_busy(guard.cancel.is_some(), &guard.progress.phase)
}

/// True when the LRC sidecar installer itself is mid-flight (own state only).
pub(crate) fn lrc_install_active(handle: &AppHandle) -> bool {
    let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() else {
        return false;
    };
    let Ok(guard) = state.0.lock() else {
        return false;
    };
    install_phase_running(&guard.progress.phase)
}

pub(crate) fn rewrite_progress_message_for_cuda(message: &str) -> String {
    message
        .replace("本机语音识别组件", "GPU 加速组件")
        .replace("语音识别组件", "GPU 加速组件")
        // LRC copy has no space before the noun; keep readable GPU phrasing.
        .replace("下载GPU", "下载 GPU")
        .replace("续传GPU", "续传 GPU")
        .replace("复制GPU", "复制 GPU")
}

pub(crate) fn update_progress(
    handle: &AppHandle,
    phase: &str,
    message: impl Into<String>,
    version: Option<String>,
    downloaded_bytes: Option<u64>,
    total_bytes: Option<u64>,
    error: Option<String>,
) {
    let message = message.into();
    // CUDA CDN download reuses the LRC download helper; route progress to CUDA only
    // so Local Runtime UI is not left stuck in "downloading".
    if cuda_install_active(handle) {
        crate::asr_sidecar::cuda_install::update_cuda_progress(
            handle,
            phase,
            rewrite_progress_message_for_cuda(&message),
            version,
            downloaded_bytes,
            total_bytes,
            error,
        );
        return;
    }

    let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() else {
        return;
    };
    let lock = state.0.lock();
    if let Ok(mut guard) = lock {
        guard.progress = LocalRuntimeInstallProgress {
            phase: phase.to_string(),
            message,
            downloaded_bytes,
            total_bytes,
            version,
            error,
        };
    }
}

pub(crate) fn append_runtime_log_line(handle: &AppHandle, line: &str) {
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

pub(crate) fn reset_cancel_handle(handle: &AppHandle) {
    if let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() {
        if let Ok(mut guard) = state.0.lock() {
            guard.cancel = None;
        }
    }
}

pub(crate) fn set_cancel_handle(handle: &AppHandle, cancel: Arc<AtomicBool>) -> Result<(), String> {
    let Some(state) = handle.try_state::<LocalRuntimeInstallerState>() else {
        return Err("local_runtime_state_missing".into());
    };
    let Ok(mut guard) = state.0.lock() else {
        return Err("local_runtime_state_poisoned".into());
    };
    guard.cancel = Some(cancel);
    Ok(())
}

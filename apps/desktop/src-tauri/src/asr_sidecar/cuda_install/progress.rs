use super::types::{AsrCudaInstallProgress, AsrCudaInstallerState};
use crate::DbState;
use tauri::{AppHandle, Manager};

pub(crate) fn cuda_install_phase_running(phase: &str) -> bool {
    crate::local_runtime::installer::progress::install_phase_running(phase)
}

pub(crate) fn update_cuda_progress(
    handle: &AppHandle,
    phase: &str,
    message: impl Into<String>,
    version: Option<String>,
    downloaded_bytes: Option<u64>,
    total_bytes: Option<u64>,
    error: Option<String>,
) {
    let Some(state) = handle.try_state::<AsrCudaInstallerState>() else {
        return;
    };
    let lock = state.0.lock();
    if let Ok(mut guard) = lock {
        guard.progress = AsrCudaInstallProgress {
            phase: phase.to_string(),
            message: message.into(),
            downloaded_bytes,
            total_bytes,
            version,
            error,
        };
    }
}

pub(crate) fn append_cuda_log_line(handle: &AppHandle, line: &str) {
    if let Some(st) = handle.try_state::<DbState>() {
        crate::project::utils::append_desktop_log_line(&st, line);
    }
}

pub fn cuda_install_progress(handle: &AppHandle) -> AsrCudaInstallProgress {
    handle
        .try_state::<AsrCudaInstallerState>()
        .and_then(|state| state.0.lock().ok().map(|guard| guard.progress.clone()))
        .unwrap_or_default()
}

pub(crate) fn reset_cuda_cancel_handle(handle: &AppHandle) {
    if let Some(state) = handle.try_state::<AsrCudaInstallerState>() {
        if let Ok(mut guard) = state.0.lock() {
            guard.cancel = None;
        }
    }
}

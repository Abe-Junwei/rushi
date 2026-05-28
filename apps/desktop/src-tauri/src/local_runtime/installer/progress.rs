use super::types::{LocalRuntimeInstallProgress, LocalRuntimeInstallerState};
use crate::DbState;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub(crate) fn install_phase_running(phase: &str) -> bool {
    matches!(phase, "downloading" | "installing" | "verifying")
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

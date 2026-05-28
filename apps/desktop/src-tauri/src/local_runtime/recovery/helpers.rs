use crate::local_runtime::installer::progress::install_phase_running;
use crate::local_runtime::installer::LocalRuntimeInstallerState;
use tauri::{AppHandle, Manager};

pub(crate) fn installer_busy(handle: &AppHandle) -> Result<bool, String> {
    let Some(installer) = handle.try_state::<LocalRuntimeInstallerState>() else {
        return Err("local_runtime_state_missing".into());
    };
    let Ok(guard) = installer.0.lock() else {
        return Err("local_runtime_state_poisoned".into());
    };
    Ok(install_phase_running(&guard.progress.phase))
}

pub(crate) fn is_transient_verify_error(err: &str) -> bool {
    err == "cancelled"
        || err
            .strip_prefix("local_runtime_verify_health_unreachable:")
            .is_some()
        || err
            .strip_prefix("local_runtime_verify_port_bind_failed:")
            .is_some()
        || err
            .strip_prefix("local_runtime_verify_port_query_failed:")
            .is_some()
        || err.contains("local_runtime_verify_process_exited:exit status: 0")
        || err.contains("local_runtime_verify_process_exited_after_health:exit status: 0")
}

pub(crate) fn should_persist_revalidate_corrupt(err: &str) -> bool {
    !is_transient_verify_error(err)
}

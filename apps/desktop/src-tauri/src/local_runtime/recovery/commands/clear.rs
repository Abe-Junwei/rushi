use super::super::helpers::installer_busy;
use crate::asr_sidecar;
use crate::local_runtime::installer::progress::{append_runtime_log_line, update_progress};
use crate::local_runtime::installer::LocalRuntimeActionResult;
use crate::local_runtime::integrity::{clear_installed_runtime, runtime_root_exists};
use crate::DbState;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn local_runtime_clear_install(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<LocalRuntimeActionResult, String> {
    if installer_busy(&app)? {
        return Ok(LocalRuntimeActionResult {
            ok: false,
            reason: Some("already_running".into()),
        });
    }
    if !runtime_root_exists(&state.inner().root) {
        update_progress(&app, "idle", String::new(), None, None, None, None);
        return Ok(LocalRuntimeActionResult {
            ok: false,
            reason: Some("not_installed".into()),
        });
    }
    asr_sidecar::stop_bundled(&app);
    clear_installed_runtime(&state.inner().root)?;
    update_progress(&app, "idle", String::new(), None, None, None, None);
    append_runtime_log_line(&app, "INFO local_runtime_cleared");
    Ok(LocalRuntimeActionResult {
        ok: true,
        reason: None,
    })
}

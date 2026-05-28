use super::async_job::spawn_blocking_runtime_job;
use super::super::helpers::installer_busy;
use super::super::run::run_restore_previous;
use crate::local_runtime::installer::LocalRuntimeActionResult;
use crate::local_runtime::integrity::inspect_installed_runtime;
use crate::DbState;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn local_runtime_restore_previous(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<LocalRuntimeActionResult, String> {
    if installer_busy(&app)? {
        return Ok(LocalRuntimeActionResult {
            ok: false,
            reason: Some("already_running".into()),
        });
    }
    let info = inspect_installed_runtime(&state.inner().root);
    if info.previous_version.is_none() {
        return Ok(LocalRuntimeActionResult {
            ok: false,
            reason: Some("no_previous".into()),
        });
    }
    let app_root = state.inner().root.clone();
    spawn_blocking_runtime_job(
        app,
        "正在恢复上一版本的本机语音识别组件…",
        info.previous_version.clone(),
        "已恢复上一版本的本机语音识别组件。",
        "恢复上一版本的本机语音识别组件失败。",
        "INFO local_runtime_restored_previous",
        "ERROR local_runtime_restore_previous_failed",
        move |cancel| run_restore_previous(&app_root, &cancel),
    )
}

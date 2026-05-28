use super::async_job::spawn_blocking_runtime_job;
use super::super::helpers::installer_busy;
use super::super::run::run_revalidate;
use crate::local_runtime::installer::LocalRuntimeActionResult;
use crate::local_runtime::integrity::{inspect_installed_runtime, InstalledRuntimeStatus};
use crate::DbState;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn local_runtime_revalidate_install(
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
    let version = info.version.clone();
    if info.executable_path.is_none() {
        return Ok(LocalRuntimeActionResult {
            ok: false,
            reason: Some(
                if info.status == InstalledRuntimeStatus::Corrupt {
                    "not_revalidatable".into()
                } else {
                    "not_installed".into()
                },
            ),
        });
    }
    let app_root = state.inner().root.clone();
    spawn_blocking_runtime_job(
        app,
        "正在重新验证本机语音识别组件…",
        version,
        "本机语音识别组件验证通过。",
        "本机语音识别组件验证失败。",
        "INFO local_runtime_revalidated",
        "ERROR local_runtime_revalidate_failed",
        move |cancel| run_revalidate(&app_root, &cancel),
    )
}

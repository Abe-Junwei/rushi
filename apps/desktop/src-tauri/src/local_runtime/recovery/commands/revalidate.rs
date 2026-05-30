use super::super::helpers::installer_busy;
use super::super::run::{run_revalidate, RevalidateOutcome};
use crate::local_runtime::installer::progress::{
    append_runtime_log_line, reset_cancel_handle, set_cancel_handle, update_progress,
};
use crate::local_runtime::installer::LocalRuntimeActionResult;
use crate::local_runtime::integrity::{inspect_installed_runtime, InstalledRuntimeStatus};
use crate::DbState;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
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
    update_progress(
        &app,
        "verifying",
        "正在重新验证本机语音识别组件…",
        version.clone(),
        None,
        None,
        None,
    );
    let cancel_flag = Arc::new(AtomicBool::new(false));
    set_cancel_handle(&app, cancel_flag.clone())?;
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = tauri::async_runtime::spawn_blocking(move || {
            run_revalidate(&app_root, &cancel_flag)
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);
        match result {
            Ok(RevalidateOutcome::Verified(version)) => {
                update_progress(
                    &app,
                    "installed",
                    "本机语音识别组件验证通过。",
                    Some(version.clone()),
                    None,
                    None,
                    None,
                );
                append_runtime_log_line(
                    &app,
                    &format!("INFO local_runtime_revalidated version={version}"),
                );
            }
            Ok(RevalidateOutcome::AutoRolledBack(version)) => {
                update_progress(
                    &app,
                    "installed",
                    format!("新版本验证失败，已自动恢复上一版本（{version}）。"),
                    Some(version.clone()),
                    None,
                    None,
                    None,
                );
                append_runtime_log_line(
                    &app,
                    &format!("INFO local_runtime_auto_rollback version={version}"),
                );
            }
            Err(err) => {
                update_progress(
                    &app,
                    "error",
                    "本机语音识别组件验证失败。",
                    None,
                    None,
                    None,
                    Some(err.clone()),
                );
                append_runtime_log_line(&app, &format!("ERROR local_runtime_revalidate_failed {err}"));
            }
        }
        reset_cancel_handle(&handle);
    });
    Ok(LocalRuntimeActionResult {
        ok: true,
        reason: None,
    })
}

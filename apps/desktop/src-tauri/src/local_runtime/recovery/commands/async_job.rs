use crate::local_runtime::installer::progress::{
    append_runtime_log_line, reset_cancel_handle, set_cancel_handle, update_progress,
};
use crate::local_runtime::installer::LocalRuntimeActionResult;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::AppHandle;

pub(crate) fn spawn_blocking_runtime_job(
    app: AppHandle,
    progress_message: impl Into<String>,
    progress_version: Option<String>,
    success_message: impl Into<String>,
    error_message: impl Into<String>,
    success_log_prefix: &'static str,
    error_log_prefix: &'static str,
    run: impl FnOnce(Arc<AtomicBool>) -> Result<String, String> + Send + 'static,
) -> Result<LocalRuntimeActionResult, String> {
    let progress_message = progress_message.into();
    let success_message = success_message.into();
    let error_message = error_message.into();
    update_progress(
        &app,
        "verifying",
        progress_message,
        progress_version,
        None,
        None,
        None,
    );
    let cancel_flag = Arc::new(AtomicBool::new(false));
    set_cancel_handle(&app, cancel_flag.clone())?;
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = tauri::async_runtime::spawn_blocking(move || run(cancel_flag))
            .await
            .map_err(|e| e.to_string())
            .and_then(|r| r);
        match result {
            Ok(version) => {
                update_progress(
                    &app,
                    "installed",
                    success_message,
                    Some(version.clone()),
                    None,
                    None,
                    None,
                );
                append_runtime_log_line(
                    &app,
                    &format!("{success_log_prefix} version={version}"),
                );
            }
            Err(err) => {
                update_progress(
                    &app,
                    "error",
                    error_message,
                    None,
                    None,
                    None,
                    Some(err.clone()),
                );
                append_runtime_log_line(&app, &format!("{error_log_prefix} {err}"));
            }
        }
        reset_cancel_handle(&handle);
    });
    Ok(LocalRuntimeActionResult {
        ok: true,
        reason: None,
    })
}

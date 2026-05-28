use super::install_support::verify_installed_runtime;
use super::installer::{
    append_runtime_log_line, install_phase_running, reset_cancel_handle, set_cancel_handle,
    update_progress, LocalRuntimeActionResult, LocalRuntimeInstallerState,
};
use super::integrity::{
    clear_installed_runtime, inspect_installed_runtime, mark_runtime_corrupt, read_marker,
    runtime_root_exists, version_dir, write_marker_with_previous,
};
use crate::asr_sidecar;
use crate::DbState;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

fn installer_busy(handle: &AppHandle) -> Result<bool, String> {
    let Some(installer) = handle.try_state::<LocalRuntimeInstallerState>() else {
        return Err("local_runtime_state_missing".into());
    };
    let Ok(guard) = installer.0.lock() else {
        return Err("local_runtime_state_poisoned".into());
    };
    Ok(install_phase_running(&guard.progress.phase))
}

fn is_transient_verify_error(err: &str) -> bool {
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

fn should_persist_revalidate_corrupt(err: &str) -> bool {
    !is_transient_verify_error(err)
}

fn run_revalidate(app_root: &std::path::Path, cancel: &Arc<AtomicBool>) -> Result<String, String> {
    let marker =
        read_marker(app_root).map_err(|_| "local_runtime_not_revalidatable".to_string())?;
    let install_dir = version_dir(app_root, &marker.version);
    let installed_exe = install_dir.join(&marker.exe_relpath);
    if !installed_exe.is_file() {
        return Err("local_runtime_executable_missing".into());
    }
    let models_root = crate::project::models_root_for_app_data_root(&app_root);
    let verify = |cancel: &Arc<AtomicBool>| {
        verify_installed_runtime(&installed_exe, Some(&models_root), Some(cancel))
    };
    match verify(cancel).or_else(|err| {
        if is_transient_verify_error(&err) && err != "cancelled" {
            verify(cancel)
        } else {
            Err(err)
        }
    }) {
        Ok(()) => {
            write_marker_with_previous(
                app_root,
                &marker.version,
                &marker.exe_relpath,
                marker
                    .previous_version
                    .as_deref()
                    .zip(marker.previous_exe_relpath.as_deref()),
                Some("ready"),
            )?;
            Ok(marker.version)
        }
        Err(err) => {
            if should_persist_revalidate_corrupt(&err) {
                let _ = mark_runtime_corrupt(app_root, &marker, Some(&err), Some("verifying"));
            }
            Err(err)
        }
    }
}

fn run_restore_previous(
    app_root: &std::path::Path,
    cancel: &Arc<AtomicBool>,
) -> Result<String, String> {
    let marker = read_marker(app_root).map_err(|_| "local_runtime_not_restorable".to_string())?;
    let Some(previous_version) = marker.previous_version.as_deref() else {
        return Err("local_runtime_no_previous".into());
    };
    let Some(previous_exe_relpath) = marker.previous_exe_relpath.as_deref() else {
        return Err("local_runtime_no_previous".into());
    };
    let previous_dir = version_dir(app_root, previous_version);
    let previous_exe = previous_dir.join(previous_exe_relpath);
    if !previous_exe.is_file() {
        return Err("local_runtime_previous_missing".into());
    }
    let models_root = crate::project::models_root_for_app_data_root(&app_root);
    verify_installed_runtime(&previous_exe, Some(&models_root), Some(cancel))?;
    write_marker_with_previous(
        app_root,
        previous_version,
        previous_exe_relpath,
        Some((marker.version.as_str(), marker.exe_relpath.as_str())),
        Some("ready"),
    )?;
    Ok(previous_version.to_string())
}

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
                if info.status == super::integrity::InstalledRuntimeStatus::Corrupt {
                    "not_revalidatable".into()
                } else {
                    "not_installed".into()
                },
            ),
        });
    }
    update_progress(
        &app,
        "verifying",
        "正在重新验证本机语音识别组件…",
        version,
        None,
        None,
        None,
    );
    let cancel_flag = Arc::new(AtomicBool::new(false));
    set_cancel_handle(&app, cancel_flag.clone())?;
    let app_root = state.inner().root.clone();
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result =
            tauri::async_runtime::spawn_blocking(move || run_revalidate(&app_root, &cancel_flag))
                .await
                .map_err(|e| e.to_string())
                .and_then(|r| r);
        match result {
            Ok(version) => {
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
                append_runtime_log_line(
                    &app,
                    &format!("ERROR local_runtime_revalidate_failed {err}"),
                );
            }
        }
        reset_cancel_handle(&handle);
    });
    Ok(LocalRuntimeActionResult {
        ok: true,
        reason: None,
    })
}

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
    update_progress(
        &app,
        "verifying",
        "正在恢复上一版本的本机语音识别组件…",
        info.previous_version.clone(),
        None,
        None,
        None,
    );
    let cancel_flag = Arc::new(AtomicBool::new(false));
    set_cancel_handle(&app, cancel_flag.clone())?;
    let app_root = state.inner().root.clone();
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = tauri::async_runtime::spawn_blocking(move || {
            run_restore_previous(&app_root, &cancel_flag)
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);
        match result {
            Ok(version) => {
                update_progress(
                    &app,
                    "installed",
                    "已恢复上一版本的本机语音识别组件。",
                    Some(version.clone()),
                    None,
                    None,
                    None,
                );
                append_runtime_log_line(
                    &app,
                    &format!("INFO local_runtime_restored_previous version={version}"),
                );
            }
            Err(err) => {
                update_progress(
                    &app,
                    "error",
                    "恢复上一版本的本机语音识别组件失败。",
                    None,
                    None,
                    None,
                    Some(err.clone()),
                );
                append_runtime_log_line(
                    &app,
                    &format!("ERROR local_runtime_restore_previous_failed {err}"),
                );
            }
        }
        reset_cancel_handle(&handle);
    });
    Ok(LocalRuntimeActionResult {
        ok: true,
        reason: None,
    })
}

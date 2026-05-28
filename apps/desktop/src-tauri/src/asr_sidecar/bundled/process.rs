use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::launch::append_sidecar_log_line;
use crate::asr_sidecar::probe::{
    bundled_health_looks_like_rushi_asr, bundled_sidecar_supports_model_catalog,
    bundled_sidecar_supports_punc_prepare,
};
use crate::asr_sidecar::{AsrSidecarState, ASR_HEALTH_URL, BUNDLED_HEALTH_POLL_MS, BUNDLED_HEALTH_WAIT_MS};
use crate::DbState;

pub(crate) fn reap_bundled_sidecar_if_exited(handle: &AppHandle) {
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        return;
    };
    let Ok(mut g) = s.0.lock() else {
        return;
    };
    if let Some(ref mut child) = *g {
        if let Ok(Some(_)) = child.try_wait() {
            *g = None;
        }
    }
}

pub(crate) fn spawn_sidecar(exe: &Path, handle: &AppHandle) -> std::io::Result<Child> {
    let workdir = exe
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut cmd = Command::new(exe);
    cmd.current_dir(&workdir)
        .env("ASR_HOST", "127.0.0.1")
        .env("ASR_PORT", crate::asr_sidecar::ASR_LOOPBACK_PORT.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(st) = handle.try_state::<DbState>() {
        let models = crate::project::models_root_for_app_data_root(&st.root);
        let hub = crate::local_asr_model::read_hub_model_pref(st.inner());
        crate::project::app_data_paths::apply_asr_model_env(&mut cmd, &models, hub.as_deref());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    append_sidecar_log_line(
        handle,
        &format!("INFO bundled_sidecar_spawn {}", exe.display()),
    );
    cmd.spawn()
}

pub(crate) fn wait_health_store_child(handle: &AppHandle, mut child: Child) -> bool {
    reap_bundled_sidecar_if_exited(handle);
    let attempts = (BUNDLED_HEALTH_WAIT_MS / BUNDLED_HEALTH_POLL_MS) as usize;
    for _ in 0..attempts {
        std::thread::sleep(Duration::from_millis(BUNDLED_HEALTH_POLL_MS));
        reap_bundled_sidecar_if_exited(handle);
        if let Ok(Some(status)) = child.try_wait() {
            append_sidecar_log_line(
                handle,
                &format!("ERROR bundled_sidecar_exited_before_health status={status}"),
            );
            return false;
        }
        if !bundled_health_looks_like_rushi_asr() {
            continue;
        }
        if !bundled_sidecar_supports_model_catalog() || !bundled_sidecar_supports_punc_prepare() {
            append_sidecar_log_line(handle, "WARN bundled_sidecar_spawn_stale_build");
            let _ = child.kill();
            let _ = child.wait();
            continue;
        }
        if let Ok(Some(status)) = child.try_wait() {
            append_sidecar_log_line(
                handle,
                &format!("ERROR bundled_sidecar_exited_after_health status={status}"),
            );
            return false;
        }
        match handle.try_state::<AsrSidecarState>() {
            Some(s) => {
                let Ok(mut g) = s.0.lock() else {
                    eprintln!("[rushi-asr-sidecar] mutex poisoned; cannot store child");
                    append_sidecar_log_line(handle, "ERROR bundled_sidecar_mutex_poisoned");
                    let _ = child.kill();
                    return false;
                };
                *g = Some(child);
            }
            None => {
                eprintln!("[rushi-asr-sidecar] internal: AsrSidecarState missing");
                append_sidecar_log_line(handle, "ERROR bundled_sidecar_state_missing");
                let _ = child.kill();
                return false;
            }
        }
        eprintln!(
            "[rushi-asr-sidecar] started bundled ASR at {}",
            ASR_HEALTH_URL
        );
        append_sidecar_log_line(handle, "INFO bundled_sidecar_health_ok");
        return true;
    }
    let _ = child.kill();
    let _ = child.wait();
    append_sidecar_log_line(handle, "ERROR bundled_sidecar_health_timeout");
    false
}

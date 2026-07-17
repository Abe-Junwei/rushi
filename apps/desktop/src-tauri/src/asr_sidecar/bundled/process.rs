use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::launch::append_sidecar_log_line;
use crate::asr_sidecar::local_token::{
    clear_managed_local_token, generate_local_token, set_managed_local_token,
};
use crate::asr_sidecar::probe::{
    bundled_health_looks_like_rushi_asr, bundled_sidecar_is_fresh_build,
};
use crate::asr_sidecar::{
    AsrSidecarState, ASR_HEALTH_URL, BUNDLED_HEALTH_POLL_MS, BUNDLED_HEALTH_WAIT_MS,
};
use crate::DbState;

fn reap_child_after_kill(child: &mut Child) {
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(50));
            }
            _ => return,
        }
    }
}

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

fn replace_bundled_child(handle: &AppHandle, mut child: Child) -> bool {
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        let _ = child.kill();
        return false;
    };
    let Ok(mut g) = s.0.lock() else {
        let _ = child.kill();
        return false;
    };
    if let Some(mut old) = g.take() {
        let _ = old.kill();
        reap_child_after_kill(&mut old);
    }
    *g = Some(child);
    true
}

fn drop_bundled_child(handle: &AppHandle) {
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        clear_managed_local_token();
        return;
    };
    let Ok(mut g) = s.0.lock() else {
        clear_managed_local_token();
        return;
    };
    if let Some(mut c) = g.take() {
        let _ = c.kill();
        reap_child_after_kill(&mut c);
    }
    clear_managed_local_token();
}

fn bundled_child_exited(handle: &AppHandle) -> bool {
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        return true;
    };
    let Ok(mut g) = s.0.lock() else {
        return true;
    };
    let Some(ref mut child) = *g else {
        return true;
    };
    if let Ok(Some(status)) = child.try_wait() {
        append_sidecar_log_line(
            handle,
            &format!("ERROR bundled_sidecar_exited_before_health status={status}"),
        );
        *g = None;
        return true;
    }
    false
}

fn prepend_path_env(cmd: &mut Command, dir: &Path) {
    if !dir.is_dir() {
        return;
    }
    let prefix = dir.to_string_lossy();
    #[cfg(windows)]
    let sep = ";";
    #[cfg(not(windows))]
    let sep = ":";
    let merged = match std::env::var("PATH") {
        Ok(existing) if !existing.is_empty() => format!("{prefix}{sep}{existing}"),
        _ => prefix.to_string(),
    };
    cmd.env("PATH", merged);
}

pub(crate) fn spawn_sidecar(exe: &Path, handle: &AppHandle) -> std::io::Result<Child> {
    let workdir = exe
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let local_token = generate_local_token();
    set_managed_local_token(Some(local_token.clone()));
    let mut cmd = Command::new(exe);
    cmd.current_dir(&workdir)
        .env("ASR_HOST", "127.0.0.1")
        .env(
            "ASR_PORT",
            crate::asr_sidecar::ASR_LOOPBACK_PORT.to_string(),
        )
        .env("RUSHI_LOCAL_TOKEN", &local_token)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    prepend_path_env(&mut cmd, &workdir.join("_internal"));
    if let Some(st) = handle.try_state::<DbState>() {
        let models = crate::project::models_root_for_app_data_root(&st.root);
        let hub = crate::local_asr_model::read_hub_model_pref(st.inner());
        let language = crate::local_asr_language::read_language_pref(st.inner());
        crate::project::app_data_paths::apply_asr_model_env(
            &mut cmd,
            &models,
            hub.as_deref(),
            Some(language.as_str()),
        );
    }
    crate::utils::no_console_window(&mut cmd);
    append_sidecar_log_line(
        handle,
        &format!("INFO bundled_sidecar_spawn {}", exe.display()),
    );
    cmd.spawn()
}

pub(crate) fn wait_health_store_child(handle: &AppHandle, child: Child) -> bool {
    reap_bundled_sidecar_if_exited(handle);
    if !replace_bundled_child(handle, child) {
        append_sidecar_log_line(handle, "ERROR bundled_sidecar_state_missing");
        return false;
    }
    let attempts = (BUNDLED_HEALTH_WAIT_MS / BUNDLED_HEALTH_POLL_MS) as usize;
    for _ in 0..attempts {
        std::thread::sleep(Duration::from_millis(BUNDLED_HEALTH_POLL_MS));
        if bundled_child_exited(handle) {
            return false;
        }
        if !bundled_health_looks_like_rushi_asr() {
            continue;
        }
        if !bundled_sidecar_is_fresh_build() {
            append_sidecar_log_line(handle, "WARN bundled_sidecar_spawn_stale_build");
            drop_bundled_child(handle);
            return false;
        }
        if bundled_child_exited(handle) {
            append_sidecar_log_line(handle, "ERROR bundled_sidecar_exited_after_health");
            return false;
        }
        eprintln!(
            "[rushi-asr-sidecar] started bundled ASR at {}",
            ASR_HEALTH_URL
        );
        append_sidecar_log_line(handle, "INFO bundled_sidecar_health_ok");
        return true;
    }
    drop_bundled_child(handle);
    append_sidecar_log_line(handle, "ERROR bundled_sidecar_health_timeout");
    false
}

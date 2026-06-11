use std::path::Path;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::launch::append_sidecar_log_line;
use super::port::kill_loopback_listeners_on_port;
use super::process::{reap_bundled_sidecar_if_exited, spawn_sidecar, wait_health_store_child};
use crate::asr_sidecar::candidates::bundled_sidecar_candidates_for_launch;
use crate::asr_sidecar::local_token::{clear_managed_local_token, resolve_local_token_for_request};
use crate::asr_sidecar::probe::{
    bundled_health_looks_like_rushi_asr, bundled_sidecar_is_fresh_build,
    loopback_local_token_required, loopback_port_accepts_tcp,
};
use crate::asr_sidecar::{
    supervisor, warm, with_asr_lifecycle, with_bundled_launch, AsrSidecarState, ASR_HEALTH_URL,
    ASR_LOOPBACK_PORT,
};

fn try_start_bundled_inner(handle: &AppHandle) {
    supervisor::set_phase(handle, supervisor::SupervisorPhase::Probing);
    if std::env::var("RUSHI_SKIP_BUNDLED_ASR").ok().as_deref() == Some("1") {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_skip_env");
        if bundled_health_looks_like_rushi_asr() && bundled_sidecar_is_fresh_build() {
            let token_required = loopback_local_token_required();
            let has_token = resolve_local_token_for_request().is_some();
            if !token_required || has_token {
                append_sidecar_log_line(handle, "INFO bundled_sidecar_skip_adopt_healthy");
                supervisor::note_ready_adopted(handle);
                warm::spawn_warmup_on_ready(handle);
                return;
            }
            append_sidecar_log_line(handle, "WARN bundled_sidecar_skip_token_mismatch");
        }
        supervisor::note_unmanaged(handle);
        return;
    }
    reap_bundled_sidecar_if_exited(handle);
    let candidates = bundled_sidecar_candidates_for_launch(handle);
    if candidates.is_empty() {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_missing");
        supervisor::note_degraded(handle, "spawn_failed");
        return;
    }
    if loopback_port_accepts_tcp(ASR_LOOPBACK_PORT) && !bundled_health_looks_like_rushi_asr() {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_port_busy_warming");
        let _ = kill_loopback_listeners_on_port(ASR_LOOPBACK_PORT);
        std::thread::sleep(Duration::from_millis(300));
    }
    if bundled_health_looks_like_rushi_asr() {
        if bundled_sidecar_is_fresh_build() {
            let token_required = loopback_local_token_required();
            let has_token = resolve_local_token_for_request().is_some();
            if token_required && !has_token {
                if std::env::var("RUSHI_SKIP_BUNDLED_ASR").ok().as_deref() == Some("1") {
                    eprintln!(
                        "[rushi-asr-sidecar] 8741 requires x-rushi-local-token but this desktop session has none. \
                         Stop the ASR on 8741 (lsof -i :8741) and restart without RUSHI_LOCAL_TOKEN, \
                         or export the same RUSHI_LOCAL_TOKEN before npm run desktop:dev."
                    );
                    append_sidecar_log_line(handle, "WARN bundled_sidecar_token_mismatch_dev");
                    return;
                }
                append_sidecar_log_line(handle, "INFO bundled_sidecar_token_mismatch_refresh");
            } else {
                eprintln!(
                    "[rushi-asr-sidecar] {} already healthy; skip bundled start.",
                    ASR_HEALTH_URL
                );
                append_sidecar_log_line(handle, "INFO bundled_sidecar_already_healthy");
                supervisor::note_ready_adopted(handle);
                warm::spawn_warmup_on_ready(handle);
                return;
            }
        } else {
            append_sidecar_log_line(handle, "INFO bundled_sidecar_stale_refresh");
        }
        supervisor::set_phase(handle, supervisor::SupervisorPhase::Stopping);
        stop_bundled(handle);
        if let Err(e) = kill_loopback_listeners_on_port(ASR_LOOPBACK_PORT) {
            append_sidecar_log_line(
                handle,
                &format!("WARN bundled_sidecar_stale_kill_failed {e}"),
            );
        } else {
            append_sidecar_log_line(handle, "INFO bundled_sidecar_stale_killed");
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    supervisor::set_phase(handle, supervisor::SupervisorPhase::Spawning);
    for exe in candidates {
        eprintln!(
            "[rushi-asr-sidecar] trying bundled executable: {}",
            exe.display()
        );
        supervisor::note_warming(handle, &exe);
        let child = match spawn_sidecar(&exe, handle) {
            Ok(c) => c,
            Err(e) => {
                eprintln!(
                    "[rushi-asr-sidecar] spawn failed for {}: {e}",
                    exe.display()
                );
                append_sidecar_log_line(
                    handle,
                    &format!("ERROR bundled_sidecar_spawn_failed {} {e}", exe.display()),
                );
                continue;
            }
        };
        if wait_health_store_child(handle, child) {
            let app_root = handle
                .try_state::<crate::DbState>()
                .map(|st| st.root.clone());
            let pid = handle.try_state::<AsrSidecarState>().and_then(|st| {
                let guard = st.0.lock().ok()?;
                Some(guard.as_ref()?.id())
            });
            supervisor::note_ready_spawned(handle, &exe, app_root.as_deref().map(Path::new), pid);
            warm::spawn_warmup_on_ready(handle);
            return;
        }
        eprintln!(
            "[rushi-asr-sidecar] {} did not become healthy in time; trying next candidate if any.",
            exe.display()
        );
        append_sidecar_log_line(
            handle,
            &format!(
                "ERROR bundled_sidecar_candidate_unhealthy {}",
                exe.display()
            ),
        );
    }
    supervisor::note_degraded(handle, "health_timeout");
    eprintln!(
        "[rushi-asr-sidecar] bundled ASR did not become healthy. \
         Set RUSHI_SKIP_BUNDLED_ASR=1 to skip, RUSHI_FORCE_BUNDLED_ASR_CPU=1 to avoid CUDA bundle, \
         or rebuild PyInstaller output (see scripts/build-asr-sidecar-*)."
    );
    append_sidecar_log_line(handle, "ERROR bundled_sidecar_all_candidates_failed");
    clear_managed_local_token();
}

/// Start bundled ASR if present and nothing is already listening on :8741.
pub fn try_start_bundled(handle: &AppHandle) {
    with_bundled_launch(|| try_start_bundled_inner(handle));
}

pub fn stop_bundled(handle: &AppHandle) {
    supervisor::set_phase(handle, supervisor::SupervisorPhase::Stopping);
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        clear_managed_local_token();
        supervisor::set_phase(handle, supervisor::SupervisorPhase::Stopped);
        return;
    };
    let Ok(mut g) = s.0.lock() else {
        clear_managed_local_token();
        return;
    };
    if let Some(mut c) = g.take() {
        let _ = c.kill();
        let _ = c.wait();
    }
    clear_managed_local_token();
    supervisor::set_phase(handle, supervisor::SupervisorPhase::Stopped);
}

/// Stop managed child and any stale listener on :8741, then start bundled sidecar again.
pub fn force_restart_bundled(handle: &AppHandle) {
    with_bundled_launch(|| force_restart_bundled_inner(handle));
}

fn force_restart_bundled_inner(handle: &AppHandle) {
    if std::env::var("RUSHI_SKIP_BUNDLED_ASR").ok().as_deref() == Some("1") {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_skip_env_restart");
        return;
    }
    supervisor::note_force_restart(handle);
    with_asr_lifecycle(|| {
        stop_bundled(handle);
        if loopback_port_accepts_tcp(ASR_LOOPBACK_PORT) {
            match kill_loopback_listeners_on_port(ASR_LOOPBACK_PORT) {
                Ok(()) => append_sidecar_log_line(handle, "INFO bundled_sidecar_killed_listeners"),
                Err(e) => append_sidecar_log_line(
                    handle,
                    &format!("WARN bundled_sidecar_kill_listeners_failed {e}"),
                ),
            }
            std::thread::sleep(Duration::from_millis(300));
        }
    });
    try_start_bundled_inner(handle);
}

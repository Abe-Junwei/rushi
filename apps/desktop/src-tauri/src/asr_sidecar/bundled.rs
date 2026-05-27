use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use super::candidates::bundled_sidecar_candidates_for_launch;
use super::probe::{
    bundled_health_looks_like_rushi_asr, bundled_sidecar_supports_model_catalog,
    bundled_sidecar_supports_punc_prepare, loopback_port_accepts_tcp,
};
use super::{AsrSidecarState, ASR_HEALTH_URL, ASR_LOOPBACK_PORT, BUNDLED_HEALTH_POLL_MS, BUNDLED_HEALTH_WAIT_MS};
use crate::DbState;

/// Last bundled sidecar launch outcome (for P1 UI when loopback ASR is unreachable).
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledAsrLaunchReport {
    pub attempted: bool,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

pub struct BundledAsrLaunchState(pub Mutex<BundledAsrLaunchReport>);

fn append_sidecar_log_line(handle: &AppHandle, line: &str) {
    if let Some(st) = handle.try_state::<DbState>() {
        crate::project::utils::append_desktop_log_line(&st, line);
    }
}

fn write_launch_report(handle: &AppHandle, report: BundledAsrLaunchReport) {
    if let Some(st) = handle.try_state::<BundledAsrLaunchState>() {
        if let Ok(mut g) = st.0.lock() {
            *g = report;
        }
    }
}

#[tauri::command]
pub fn bundled_asr_launch_report(
    state: tauri::State<BundledAsrLaunchState>,
) -> BundledAsrLaunchReport {
    state.0.lock().map(|g| g.clone()).unwrap_or_default()
}

fn reap_bundled_sidecar_if_exited(handle: &AppHandle) {
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

#[cfg(unix)]
fn kill_loopback_listeners_on_port(port: u16) -> Result<(), String> {
    use std::process::Command;
    let port_arg = format!(":{port}");
    let pids = Command::new("lsof")
        .args(["-ti", &port_arg])
        .output()
        .map_err(|e| format!("无法执行 lsof：{e}"))?;
    let stdout = String::from_utf8_lossy(&pids.stdout);
    if stdout.trim().is_empty() {
        return Ok(());
    }
    for pid in stdout.split_whitespace() {
        let _ = Command::new("kill").arg(pid).status();
    }
    std::thread::sleep(Duration::from_millis(400));
    let pids = Command::new("lsof")
        .args(["-ti", &port_arg])
        .output()
        .map_err(|e| format!("无法执行 lsof：{e}"))?;
    let stdout = String::from_utf8_lossy(&pids.stdout);
    for pid in stdout.split_whitespace() {
        let _ = Command::new("kill").args(["-9", pid]).status();
    }
    Ok(())
}

#[cfg(not(unix))]
fn kill_loopback_listeners_on_port(port: u16) -> Result<(), String> {
    let _ = port;
    Err("当前平台暂不支持自动结束占用 8741 的侧车进程".into())
}

fn spawn_sidecar(exe: &Path, handle: &AppHandle) -> std::io::Result<Child> {
    let workdir = exe
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut cmd = Command::new(exe);
    cmd.current_dir(&workdir)
        .env("ASR_HOST", "127.0.0.1")
        .env("ASR_PORT", "8741")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(st) = handle.try_state::<DbState>() {
        let models = st.root.join("models");
        if std::fs::create_dir_all(&models).is_ok() {
            cmd.env("RUSHI_MODELS_ROOT", &models);
            let ms = models.join("modelscope");
            let _ = std::fs::create_dir_all(&ms);
            cmd.env("MODELSCOPE_CACHE", &ms);
            let hf = models.join("huggingface");
            let _ = std::fs::create_dir_all(&hf);
            cmd.env("HF_HOME", &hf);
        }
        if let Some(hub) = crate::local_asr_model::read_hub_model_pref(st.inner()) {
            cmd.env("RUSHI_FUNASR_MODEL", hub);
        }
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

fn wait_health_store_child(handle: &AppHandle, mut child: Child) -> bool {
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

/// Start bundled ASR if present and nothing is already listening on :8741.
pub fn try_start_bundled(handle: &AppHandle) {
    write_launch_report(handle, BundledAsrLaunchReport::default());
    if std::env::var("RUSHI_SKIP_BUNDLED_ASR").ok().as_deref() == Some("1") {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_skip_env");
        return;
    }
    reap_bundled_sidecar_if_exited(handle);
    let candidates = bundled_sidecar_candidates_for_launch(handle);
    if candidates.is_empty() {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_missing");
        return;
    }
    if bundled_health_looks_like_rushi_asr() {
        if bundled_sidecar_supports_model_catalog() && bundled_sidecar_supports_punc_prepare() {
            eprintln!(
                "[rushi-asr-sidecar] {} already healthy; skip bundled start.",
                ASR_HEALTH_URL
            );
            append_sidecar_log_line(handle, "INFO bundled_sidecar_already_healthy");
            return;
        }
        append_sidecar_log_line(handle, "INFO bundled_sidecar_stale_refresh");
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
    write_launch_report(
        handle,
        BundledAsrLaunchReport {
            attempted: true,
            success: false,
            detail: None,
        },
    );
    for exe in candidates {
        eprintln!(
            "[rushi-asr-sidecar] trying bundled executable: {}",
            exe.display()
        );
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
            write_launch_report(
                handle,
                BundledAsrLaunchReport {
                    attempted: true,
                    success: true,
                    detail: None,
                },
            );
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
    let detail = Some(
        "已尝试启动安装包内的推理侧车，但在等待时间内未收到 /health 成功响应（若同时存在 CUDA 与 CPU 包，可能均已失败）。\
         请确认本机 8741 端口未被其他 rushi-asr 占用；可设置 RUSHI_SKIP_BUNDLED_ASR=1 后手动启动 ASR，\
         或使用「导出诊断包」查看更多信息。"
            .to_string(),
    );
    write_launch_report(
        handle,
        BundledAsrLaunchReport {
            attempted: true,
            success: false,
            detail,
        },
    );
    eprintln!(
        "[rushi-asr-sidecar] bundled ASR did not become healthy. \
         Set RUSHI_SKIP_BUNDLED_ASR=1 to skip, RUSHI_FORCE_BUNDLED_ASR_CPU=1 to avoid CUDA bundle, \
         or rebuild PyInstaller output (see scripts/build-asr-sidecar-*)."
    );
    append_sidecar_log_line(handle, "ERROR bundled_sidecar_all_candidates_failed");
}

pub fn stop_bundled(handle: &AppHandle) {
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        return;
    };
    let Ok(mut g) = s.0.lock() else {
        return;
    };
    if let Some(mut c) = g.take() {
        let _ = c.kill();
        let _ = c.wait();
    }
}

/// Stop managed child and any stale listener on :8741, then start bundled sidecar again.
pub fn force_restart_bundled(handle: &AppHandle) {
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
    try_start_bundled(handle);
}

/// Stop bundled sidecar (if we started it) and try starting again (e.g. after a transient failure).
pub fn retry_bundled(handle: &AppHandle) {
    force_restart_bundled(handle);
}

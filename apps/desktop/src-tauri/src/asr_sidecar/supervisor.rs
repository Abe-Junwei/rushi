//! R3h-I1: explicit sidecar supervisor FSM + runtime identity (ASR-WARM consumes).

use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::bundled::launch::{write_launch_report, BundledAsrLaunchReport};
use super::probe::{
    bundled_health_looks_like_rushi_asr, bundled_sidecar_is_fresh_build, AsrPortStatus,
};
use super::ASR_LOOPBACK_PORT;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SupervisorPhase {
    Idle,
    Unmanaged,
    Probing,
    Stopping,
    Spawning,
    Warming,
    Ready,
    Degraded,
    Stopped,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutableSource {
    None,
    BundledMedia,
    LrcInstalled,
    DevSource,
    ExternalListener,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupervisorSnapshot {
    pub runtime_session_id: String,
    pub launch_generation: u64,
    pub phase: SupervisorPhase,
    pub executable_source: ExecutableSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub managed_child_pid: Option<u32>,
    pub loopback_port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port_status: Option<AsrPortStatus>,
    pub health_fresh: bool,
    pub local_token_managed: bool,
    pub last_transition_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_executable: Option<String>,
    pub warmup_completed: bool,
    pub last_activity_ms: u64,
}

impl SupervisorSnapshot {
    pub fn new_session() -> Self {
        Self {
            runtime_session_id: Uuid::new_v4().to_string(),
            launch_generation: 0,
            phase: SupervisorPhase::Idle,
            executable_source: ExecutableSource::None,
            managed_child_pid: None,
            loopback_port: ASR_LOOPBACK_PORT,
            port_status: None,
            health_fresh: false,
            local_token_managed: false,
            last_transition_ms: now_ms(),
            last_error_code: None,
            active_executable: None,
            warmup_completed: false,
            last_activity_ms: now_ms(),
        }
    }
}

pub struct AsrSupervisorState(pub Mutex<SupervisorSnapshot>);

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn idle_stopped_after_success(snap: &SupervisorSnapshot) -> bool {
    snap.phase == SupervisorPhase::Stopped
        && snap.last_error_code.is_none()
        && snap.executable_source != ExecutableSource::None
}

pub fn launch_report_from_snapshot(snap: &SupervisorSnapshot) -> BundledAsrLaunchReport {
    let attempted = matches!(
        snap.phase,
        SupervisorPhase::Spawning
            | SupervisorPhase::Warming
            | SupervisorPhase::Degraded
            | SupervisorPhase::Ready
            | SupervisorPhase::Stopping
    ) || idle_stopped_after_success(snap);
    let success = snap.phase == SupervisorPhase::Ready || idle_stopped_after_success(snap);
    let detail = snap.last_error_code.as_ref().map(|code| match code.as_str() {
        "health_timeout" => {
            "已尝试启动安装包内的推理侧车，但在等待时间内未收到 /health 成功响应（若同时存在 CUDA 与 CPU 包，可能均已失败）。\
             请确认本机 8741 端口未被其他 rushi-asr 占用；可设置 RUSHI_SKIP_BUNDLED_ASR=1 后手动启动 ASR，\
             或使用「导出诊断包」查看更多信息。"
                .to_string()
        }
        "foreign_port" => "8741 端口被其他程序占用。".to_string(),
        "spawn_failed" => "无法启动内置侧车可执行文件。".to_string(),
        "child_exited" => "侧车进程在就绪前退出。".to_string(),
        "health_lost" => "侧车曾就绪但后续 /health 不可用。".to_string(),
        other => other.to_string(),
    });
    BundledAsrLaunchReport {
        attempted,
        success,
        detail,
    }
}

fn sync_launch_report(handle: &AppHandle, snap: &SupervisorSnapshot) {
    write_launch_report(handle, launch_report_from_snapshot(snap));
}

fn with_snapshot<R>(handle: &AppHandle, f: impl FnOnce(&mut SupervisorSnapshot) -> R) -> Option<R> {
    let st = handle.try_state::<AsrSupervisorState>()?;
    let mut g = st.0.lock().ok()?;
    let out = f(&mut g);
    Some(out)
}

pub fn set_phase(handle: &AppHandle, phase: SupervisorPhase) {
    let _ = with_snapshot(handle, |snap| {
        snap.phase = phase;
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_error(handle: &AppHandle, code: &str) {
    let _ = with_snapshot(handle, |snap| {
        snap.last_error_code = Some(code.to_string());
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_unmanaged(handle: &AppHandle) {
    let _ = with_snapshot(handle, |snap| {
        snap.phase = SupervisorPhase::Unmanaged;
        snap.executable_source = ExecutableSource::DevSource;
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_force_restart(handle: &AppHandle) {
    let _ = with_snapshot(handle, |snap| {
        snap.launch_generation = snap.launch_generation.saturating_add(1);
        snap.phase = SupervisorPhase::Stopping;
        snap.warmup_completed = false;
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_ready_adopted(handle: &AppHandle) {
    let _ = with_snapshot(handle, |snap| {
        snap.phase = SupervisorPhase::Ready;
        snap.executable_source = ExecutableSource::ExternalListener;
        snap.managed_child_pid = None;
        snap.health_fresh = bundled_sidecar_is_fresh_build();
        snap.local_token_managed = super::local_token::resolve_local_token_for_request().is_some();
        snap.last_error_code = None;
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_ready_spawned(
    handle: &AppHandle,
    exe: &Path,
    app_root: Option<&Path>,
    child_pid: Option<u32>,
) {
    let source = classify_executable_source(exe, app_root);
    let active = exe
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .or_else(|| Some(exe.display().to_string()));
    let _ = with_snapshot(handle, |snap| {
        snap.phase = SupervisorPhase::Ready;
        snap.executable_source = source;
        snap.managed_child_pid = child_pid;
        snap.health_fresh = bundled_sidecar_is_fresh_build();
        snap.local_token_managed = super::local_token::resolve_local_token_for_request().is_some();
        snap.active_executable = active;
        snap.last_error_code = None;
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_warming(handle: &AppHandle, exe: &Path) {
    let active = exe.file_name().map(|s| s.to_string_lossy().into_owned());
    let _ = with_snapshot(handle, |snap| {
        snap.phase = SupervisorPhase::Warming;
        snap.active_executable = active;
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_degraded(handle: &AppHandle, code: &str) {
    let _ = with_snapshot(handle, |snap| {
        snap.phase = SupervisorPhase::Degraded;
        snap.last_error_code = Some(code.to_string());
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn note_warmup_done(handle: &AppHandle) {
    let _ = with_snapshot(handle, |snap| {
        snap.warmup_completed = true;
        snap.last_transition_ms = now_ms();
    });
}

#[allow(dead_code)]
pub fn record_activity(handle: &AppHandle) {
    let _ = with_snapshot(handle, |snap| {
        snap.last_activity_ms = now_ms();
    });
}

pub fn record_activity_global() {
    // Transcribe path has no AppHandle; activity also updated via warm module static.
    super::warm::touch_global_activity_ms();
}

pub fn snapshot(handle: &AppHandle) -> SupervisorSnapshot {
    handle
        .try_state::<AsrSupervisorState>()
        .and_then(|st| st.0.lock().ok().map(|g| g.clone()))
        .unwrap_or_else(SupervisorSnapshot::new_session)
}

pub fn classify_executable_source(exe: &Path, app_root: Option<&Path>) -> ExecutableSource {
    if let Some(root) = app_root {
        if let Some(installed) = crate::local_runtime::integrity::resolve_installed_executable(root)
        {
            if installed == exe {
                return ExecutableSource::LrcInstalled;
            }
            if let Ok(inst_canon) = installed.canonicalize() {
                if let Ok(exe_canon) = exe.canonicalize() {
                    if exe_canon.starts_with(inst_canon.parent().unwrap_or(inst_canon.as_path())) {
                        return ExecutableSource::LrcInstalled;
                    }
                }
            }
        }
    }
    ExecutableSource::BundledMedia
}

pub fn refresh_health_flags(handle: &AppHandle) {
    let fresh = bundled_sidecar_is_fresh_build();
    let token = super::local_token::resolve_local_token_for_request().is_some();
    let _ = with_snapshot(handle, |snap| {
        snap.health_fresh = fresh;
        snap.local_token_managed = token;
    });
}

pub fn note_recover_from_health_lost(handle: &AppHandle) {
    let _ = with_snapshot(handle, |snap| {
        if snap.phase != SupervisorPhase::Degraded {
            return;
        }
        if snap.last_error_code.as_deref() != Some("health_lost") {
            return;
        }
        snap.phase = SupervisorPhase::Ready;
        snap.last_error_code = None;
        snap.last_transition_ms = now_ms();
        sync_launch_report(handle, snap);
    });
}

pub fn watchdog_tick(handle: &AppHandle) -> bool {
    super::bundled::process::reap_bundled_sidecar_if_exited(handle);
    let snap = snapshot(handle);
    let healthy = bundled_health_looks_like_rushi_asr();
    if snap.phase == SupervisorPhase::Ready && !healthy {
        if super::probe::loopback_model_prepare_running() {
            return true;
        }
        note_degraded(handle, "health_lost");
        return false;
    }
    if snap.phase == SupervisorPhase::Degraded
        && healthy
        && snap.last_error_code.as_deref() == Some("health_lost")
    {
        note_recover_from_health_lost(handle);
    }
    true
}

#[tauri::command]
pub fn asr_supervisor_snapshot(state: tauri::State<AsrSupervisorState>) -> SupervisorSnapshot {
    state.0.lock().map(|g| g.clone()).unwrap_or_else(|e| {
        let snap = SupervisorSnapshot::new_session();
        *e.into_inner() = snap.clone();
        snap
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_report_ready_success() {
        let mut snap = SupervisorSnapshot::new_session();
        snap.launch_generation = 1;
        snap.phase = SupervisorPhase::Ready;
        let r = launch_report_from_snapshot(&snap);
        assert!(r.success);
    }

    #[test]
    fn launch_report_degraded_not_success() {
        let mut snap = SupervisorSnapshot::new_session();
        snap.phase = SupervisorPhase::Degraded;
        snap.last_error_code = Some("health_timeout".into());
        let r = launch_report_from_snapshot(&snap);
        assert!(!r.success);
        assert!(r.detail.is_some());
    }

    #[test]
    fn launch_report_idle_stopped_keeps_success() {
        let mut snap = SupervisorSnapshot::new_session();
        snap.phase = SupervisorPhase::Stopped;
        snap.executable_source = ExecutableSource::BundledMedia;
        let r = launch_report_from_snapshot(&snap);
        assert!(r.attempted);
        assert!(r.success);
    }
}

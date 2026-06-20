//! Optional bundled ASR sidecar (PyInstaller onedir under `resources/bundled-asr/`).
//! If `127.0.0.1:8741/health` is already up, we do not start a second server.

use std::process::Child;
use std::sync::{Mutex, OnceLock};

use tauri::AppHandle;

use crate::DbState;

pub(crate) mod bundled;
pub mod candidates;
pub(crate) mod local_token;
pub mod loopback;
mod probe;
pub(crate) mod source;
pub mod supervisor;
pub mod warm;

#[cfg(test)]
mod tests;

pub use bundled::{
    force_restart_bundled, stop_bundled, try_start_bundled, BundledAsrLaunchReport,
    BundledAsrLaunchState,
};
pub use candidates::bundled_sidecar_resources_present;
pub use source::restart_source_asr_sidecar;
pub use supervisor::{AsrSupervisorState, SupervisorSnapshot};

/// Restart loopback ASR: bundled PyInstaller or source venv when `RUSHI_SKIP_BUNDLED_ASR=1`.
pub fn restart_loopback_asr(handle: &AppHandle, st: &DbState) -> Result<(), String> {
    if app_manages_bundled_sidecar() {
        force_restart_bundled(handle);
        Ok(())
    } else {
        with_bundled_launch(|| restart_source_asr_sidecar(handle, st))
    }
}

pub(crate) use probe::AsrHealthBody;
pub use probe::{
    fetch_loopback_prepare_status_json, is_rushi_asr_health_json,
    loopback_root_declares_transcribe_async, probe_asr_port_and_health, probe_asr_port_sync,
    AsrPortStatus,
};

/// True when the desktop shell may spawn/restart the PyInstaller sidecar (false in `desktop:dev`).
pub fn app_manages_bundled_sidecar() -> bool {
    std::env::var("RUSHI_SKIP_BUNDLED_ASR").ok().as_deref() != Some("1")
}

/// End any process listening on loopback :8741 (dev model switch / stale sidecar).
pub fn kill_loopback_asr_listeners() -> Result<(), String> {
    bundled::port::kill_loopback_listeners_on_port(ASR_LOOPBACK_PORT)
}

#[tauri::command]
pub fn asr_app_manages_bundled_sidecar() -> bool {
    app_manages_bundled_sidecar()
}

#[tauri::command]
pub fn kill_loopback_asr_listeners_cmd() -> Result<(), String> {
    kill_loopback_asr_listeners()
}

pub const ASR_HEALTH_URL: &str = "http://127.0.0.1:8741/health";
pub(crate) const ASR_LOOPBACK_PORT: u16 = 8741;
pub(crate) const BUNDLED_HEALTH_WAIT_MS: u64 = 45_000;
pub(crate) const BUNDLED_HEALTH_POLL_MS: u64 = 250;

static ASR_LIFECYCLE: OnceLock<Mutex<()>> = OnceLock::new();
static BUNDLED_LAUNCH: OnceLock<Mutex<()>> = OnceLock::new();

/// Serialize bundled sidecar stop/kill (short critical section).
pub(crate) fn with_asr_lifecycle<R>(f: impl FnOnce() -> R) -> R {
    let mutex = ASR_LIFECYCLE.get_or_init(|| Mutex::new(()));
    let _guard = mutex.lock().unwrap_or_else(|e| e.into_inner());
    f()
}

/// Serialize full bundled start/restart (health poll may take ~45s).
pub(crate) fn with_bundled_launch<R>(f: impl FnOnce() -> R) -> R {
    let mutex = BUNDLED_LAUNCH.get_or_init(|| Mutex::new(()));
    let _guard = mutex.lock().unwrap_or_else(|e| e.into_inner());
    f()
}

pub struct AsrSidecarState(pub Mutex<Option<Child>>);

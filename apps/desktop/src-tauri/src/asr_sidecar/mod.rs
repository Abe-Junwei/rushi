//! Optional bundled ASR sidecar (PyInstaller onedir under `resources/bundled-asr/`).
//! If `127.0.0.1:8741/health` is already up, we do not start a second server.

pub(crate) mod bundled;
pub mod candidates;
pub(crate) mod local_token;
pub mod loopback;
mod probe;

#[cfg(test)]
mod tests;

pub use bundled::{
    force_restart_bundled, retry_bundled, stop_bundled, try_start_bundled, BundledAsrLaunchReport,
    BundledAsrLaunchState,
};
pub use candidates::bundled_sidecar_resources_present;
pub use probe::{
    bundled_sidecar_is_fresh_build, bundled_sidecar_supports_transcribe_async,
    is_rushi_asr_health_json, loopback_root_declares_transcribe_async, probe_asr_port, AsrPortStatus,
};

use std::process::Child;
use std::sync::{Mutex, OnceLock};

pub const ASR_HEALTH_URL: &str = "http://127.0.0.1:8741/health";
pub(crate) const ASR_LOOPBACK_PORT: u16 = 8741;
pub(crate) const BUNDLED_HEALTH_WAIT_MS: u64 = 45_000;
pub(crate) const BUNDLED_HEALTH_POLL_MS: u64 = 250;

static ASR_LIFECYCLE: OnceLock<Mutex<()>> = OnceLock::new();

/// Serialize bundled sidecar restart vs install/pref apply paths that also restart ASR.
pub(crate) fn with_asr_lifecycle<R>(f: impl FnOnce() -> R) -> R {
    let mutex = ASR_LIFECYCLE.get_or_init(|| Mutex::new(()));
    let _guard = mutex.lock().unwrap_or_else(|e| e.into_inner());
    f()
}

pub struct AsrSidecarState(pub Mutex<Option<Child>>);

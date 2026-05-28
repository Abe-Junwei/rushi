//! Optional bundled ASR sidecar (PyInstaller onedir under `resources/bundled-asr/`).
//! If `127.0.0.1:8741/health` is already up, we do not start a second server.

pub(crate) mod bundled;
pub mod candidates;
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
    bundled_health_looks_like_rushi_asr, bundled_sidecar_supports_model_catalog,
    bundled_sidecar_supports_punc_prepare, is_rushi_asr_health_json, probe_asr_port,
    AsrPortProbe, AsrPortStatus,
};

use std::process::Child;
use std::sync::Mutex;

pub const ASR_HEALTH_URL: &str = "http://127.0.0.1:8741/health";
pub(crate) const ASR_LOOPBACK_PORT: u16 = 8741;
pub(crate) const BUNDLED_HEALTH_WAIT_MS: u64 = 45_000;
pub(crate) const BUNDLED_HEALTH_POLL_MS: u64 = 250;

pub struct AsrSidecarState(pub Mutex<Option<Child>>);

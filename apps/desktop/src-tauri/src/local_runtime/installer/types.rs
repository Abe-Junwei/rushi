use serde::Serialize;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeInstallProgress {
    pub phase: String,
    pub message: String,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub version: Option<String>,
    pub error: Option<String>,
}

impl Default for LocalRuntimeInstallProgress {
    fn default() -> Self {
        Self {
            phase: "idle".into(),
            message: String::new(),
            downloaded_bytes: None,
            total_bytes: None,
            version: None,
            error: None,
        }
    }
}

#[derive(Default)]
pub(crate) struct InstallerStateInner {
    pub(crate) progress: LocalRuntimeInstallProgress,
    pub(crate) cancel: Option<Arc<AtomicBool>>,
}

pub struct LocalRuntimeInstallerState(pub(crate) Mutex<InstallerStateInner>);

impl Default for LocalRuntimeInstallerState {
    fn default() -> Self {
        Self(Mutex::new(InstallerStateInner::default()))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeDownloadResult {
    pub started: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeActionResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

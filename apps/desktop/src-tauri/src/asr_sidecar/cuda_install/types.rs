use serde::Serialize;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrCudaInstallProgress {
    pub phase: String,
    pub message: String,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub version: Option<String>,
    pub error: Option<String>,
}

impl Default for AsrCudaInstallProgress {
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
pub(crate) struct AsrCudaInstallerInner {
    pub(crate) progress: AsrCudaInstallProgress,
    pub(crate) cancel: Option<Arc<AtomicBool>>,
}

pub struct AsrCudaInstallerState(pub(crate) Mutex<AsrCudaInstallerInner>);

impl Default for AsrCudaInstallerState {
    fn default() -> Self {
        Self(Mutex::new(AsrCudaInstallerInner::default()))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrCudaSidecarStatus {
    pub platform_supported: bool,
    pub nvidia_detected: bool,
    pub cuda_installed: bool,
    pub manifest_configured: bool,
    pub recommend_download: bool,
    pub manifest_issue: Option<String>,
    pub installed_version: Option<String>,
    pub install: AsrCudaInstallProgress,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrCudaDownloadResult {
    pub started: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

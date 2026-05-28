use serde::Serialize;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InstalledRuntimeStatus {
    Missing,
    Installed,
    Corrupt,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledRuntimeInfo {
    pub status: InstalledRuntimeStatus,
    pub version: Option<String>,
    pub previous_version: Option<String>,
    pub executable_path: Option<String>,
    pub root_dir: String,
    pub detail: Option<String>,
    pub last_verify_error: Option<String>,
    pub last_install_phase: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InstalledRuntimeMarker {
    pub version: String,
    pub exe_relpath: String,
    pub verify_state: Option<String>,
    pub previous_version: Option<String>,
    pub previous_exe_relpath: Option<String>,
    pub last_verify_error: Option<String>,
    pub last_install_phase: Option<String>,
}

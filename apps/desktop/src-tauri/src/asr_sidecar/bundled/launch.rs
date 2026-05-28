use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

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

pub(crate) fn append_sidecar_log_line(handle: &AppHandle, line: &str) {
    if let Some(st) = handle.try_state::<DbState>() {
        crate::project::utils::append_desktop_log_line(&st, line);
    }
}

pub(crate) fn write_launch_report(handle: &AppHandle, report: BundledAsrLaunchReport) {
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

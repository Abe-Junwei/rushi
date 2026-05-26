pub mod installer;
pub mod integrity;
pub mod manifest;

use installer::{install_progress, LocalRuntimeInstallProgress};
use integrity::{inspect_installed_runtime, InstalledRuntimeInfo};
use manifest::{current_platform_key, parse_manifest, select_asr_sidecar_component};
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::DbState;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeDiagnose {
    pub manifest_configured: bool,
    pub manifest_source: Option<String>,
    pub manifest_status: String,
    pub available_version: Option<String>,
    pub install: LocalRuntimeInstallProgress,
    pub installed: InstalledRuntimeInfo,
    pub blocking_issue: Option<String>,
}

fn manifest_source_from_env() -> Option<String> {
    let raw = std::env::var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL").ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn is_http_source(source: &str) -> bool {
    source.strip_prefix("http://").is_some() || source.strip_prefix("https://").is_some()
}

fn manifest_status(source: Option<&str>) -> (String, Option<String>) {
    let Some(source) = source else {
        return ("missing".into(), None);
    };
    let text = if is_http_source(source) {
        tauri::async_runtime::block_on(async move {
            let resp = reqwest::Client::new().get(source).send().await.ok()?;
            if !resp.status().is_success() {
                return None;
            }
            resp.text().await.ok()
        })
    } else {
        std::fs::read_to_string(source.strip_prefix("file://").unwrap_or(source)).ok()
    };
    let Some(text) = text else {
        return ("error".into(), None);
    };
    let Ok(manifest) = parse_manifest(&text) else {
        return ("error".into(), None);
    };
    let version = select_asr_sidecar_component(&manifest, &current_platform_key())
        .map(|component| component.version.clone());
    ("ok".into(), version)
}

#[tauri::command]
pub fn local_runtime_diagnose(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<LocalRuntimeDiagnose, String> {
    let manifest_source = manifest_source_from_env();
    let (manifest_status, available_version) = manifest_status(manifest_source.as_deref());
    let installed = inspect_installed_runtime(&state.inner().root);
    let install = install_progress(&app);
    let blocking_issue = match install.phase.as_str() {
        "error" => install.error.clone(),
        "cancelled" => Some("已取消本机语音识别组件下载。".into()),
        _ if installed.status == integrity::InstalledRuntimeStatus::Corrupt => installed.detail.clone(),
        _ if manifest_status == "missing" && installed.status != integrity::InstalledRuntimeStatus::Installed => {
            Some("未配置本机语音识别组件 manifest，无法应用内下载安装侧车。".into())
        }
        _ => None,
    };
    Ok(LocalRuntimeDiagnose {
        manifest_configured: manifest_source.is_some(),
        manifest_source,
        manifest_status,
        available_version,
        install,
        installed,
        blocking_issue,
    })
}

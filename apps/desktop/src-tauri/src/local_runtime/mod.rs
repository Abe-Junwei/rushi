pub(crate) mod catalog;
mod errors;
mod install_support;
pub mod installer;
pub mod integrity;
pub mod manifest;
pub mod recovery;

pub(crate) use install_support::disk_free_bytes;

use catalog::diagnose_configured_manifest;
use errors::describe_local_runtime_error;
use installer::{install_progress, LocalRuntimeInstallProgress};
use integrity::{inspect_installed_runtime, InstalledRuntimeInfo};
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::DbState;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeDiagnose {
    pub manifest_configured: bool,
    pub manifest_source: Option<String>,
    pub manifest_status: String,
    pub manifest_issue: Option<String>,
    pub manifest_signature_key_id: Option<String>,
    pub available_version: Option<String>,
    pub available_size_bytes: Option<u64>,
    pub required_disk_bytes: Option<u64>,
    pub free_disk_bytes: Option<u64>,
    pub install: LocalRuntimeInstallProgress,
    pub installed: InstalledRuntimeInfo,
    pub blocking_issue: Option<String>,
}

const INSTALL_DISK_HEADROOM_BYTES: u64 = 512 * 1024 * 1024;

fn required_install_bytes(size_bytes: Option<u64>) -> Option<u64> {
    size_bytes.map(|size| {
        size.saturating_mul(3)
            .saturating_add(INSTALL_DISK_HEADROOM_BYTES)
    })
}

#[tauri::command]
pub async fn local_runtime_diagnose(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<LocalRuntimeDiagnose, String> {
    // Manifest probe may perform HTTPS I/O; keep it off the WebView main thread.
    let manifest = tauri::async_runtime::spawn_blocking(diagnose_configured_manifest)
        .await
        .map_err(|e| format!("local_runtime_diagnose_join:{e}"))?;
    let installed = inspect_installed_runtime(&state.inner().root);
    let install = install_progress(&app);
    let free_disk_bytes = disk_free_bytes(&integrity::local_runtime_root(&state.inner().root));
    let required_disk_bytes = required_install_bytes(manifest.available_size_bytes);
    let blocking_issue = match install.phase.as_str() {
        "error" => install.error.as_deref().map(describe_local_runtime_error),
        "cancelled" => Some("已取消本机语音识别组件下载。".into()),
        _ if matches!(
            manifest.status.as_str(),
            "missing" | "error" | "incompatible" | "source_rejected" | "signature_invalid"
        ) =>
        {
            manifest.blocking_issue.clone()
        }
        _ if installed.status == integrity::InstalledRuntimeStatus::Corrupt => {
            installed.detail.clone()
        }
        _ => None,
    };
    Ok(LocalRuntimeDiagnose {
        manifest_configured: manifest.source.is_some(),
        manifest_source: manifest.source,
        manifest_status: manifest.status,
        manifest_issue: manifest.blocking_issue,
        manifest_signature_key_id: manifest.signature_key_id,
        available_version: manifest.available_version,
        available_size_bytes: manifest.available_size_bytes,
        required_disk_bytes,
        free_disk_bytes,
        install,
        installed,
        blocking_issue,
    })
}

#[cfg(test)]
mod tests {
    use super::describe_local_runtime_error;

    #[test]
    fn describe_local_runtime_error_maps_known_runtime_failures() {
        assert!(
            describe_local_runtime_error("local_runtime_executable_missing").contains("可执行文件")
        );
        assert!(
            describe_local_runtime_error("local_runtime_component_missing:linux-x64")
                .contains("本平台")
        );
        assert!(describe_local_runtime_error(
            "local_runtime_shell_version_incompatible:0.1.0:0.2.0"
        )
        .contains("版本过低"));
        assert!(
            describe_local_runtime_error("backup_runtime_failed:disk busy")
                .contains("备份当前版本失败")
        );
        assert!(
            describe_local_runtime_error("promote_runtime_failed:rename")
                .contains("切换到新版本时失败")
        );
        assert!(describe_local_runtime_error("artifact_http_500").contains("下载语音识别组件失败"));
        assert!(describe_local_runtime_error("open_zip_failed:bad zip").contains("压缩包无效"));
        assert!(
            describe_local_runtime_error("local_runtime_not_revalidatable")
                .contains("元数据已损坏")
        );
    }
}

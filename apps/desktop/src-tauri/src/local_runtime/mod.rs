pub(crate) mod catalog;
pub mod installer;
pub mod integrity;
pub mod manifest;
pub mod recovery;
mod install_support;

use catalog::{diagnose_configured_manifest, manifest_blocking_issue};
use installer::{install_progress, LocalRuntimeInstallProgress};
use integrity::{inspect_installed_runtime, InstalledRuntimeInfo};
use install_support::disk_free_bytes;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::DbState;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRuntimeDiagnose {
    pub manifest_configured: bool,
    pub manifest_source: Option<String>,
    pub manifest_status: String,
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

fn describe_local_runtime_error(error: &str) -> String {
    if let Some(message) = manifest_blocking_issue(error) {
        return message;
    }
    if let Some((free, required)) = error
        .strip_prefix("local_runtime_disk_space_low:")
        .and_then(|tail| tail.split_once(':'))
    {
        return format!(
            "磁盘可用空间不足，无法下载安装语音识别组件（可用 {free} bytes，预计至少需要 {required} bytes）。"
        );
    }
    match error {
        "local_runtime_sha256_mismatch" => {
            "下载到的语音识别组件校验失败（SHA256 不匹配），已拒绝安装。".into()
        }
        "local_runtime_extract_too_many_entries" | "local_runtime_extract_size_limit_exceeded" => {
            "下载到的语音识别组件压缩包结构异常，已拒绝解压。".into()
        }
        "local_runtime_no_previous" => "当前没有可恢复的上一版本侧车。".into(),
        "local_runtime_previous_missing" => "记录中的上一版本侧车目录已缺失，无法恢复。".into(),
        _ if error.strip_prefix("local_runtime_verify_").is_some() => {
            "语音识别组件已下载，但健康验证未通过。可尝试重新验证、恢复上一版或导出诊断包。".into()
        }
        _ => error.to_string(),
    }
}

#[tauri::command]
pub fn local_runtime_diagnose(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<LocalRuntimeDiagnose, String> {
    let manifest = diagnose_configured_manifest();
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
        ) && installed.status != integrity::InstalledRuntimeStatus::Installed =>
        {
            manifest.blocking_issue.clone()
        }
        _ if installed.status == integrity::InstalledRuntimeStatus::Corrupt => installed.detail.clone(),
        _ => None,
    };
    Ok(LocalRuntimeDiagnose {
        manifest_configured: manifest.source.is_some(),
        manifest_source: manifest.source,
        manifest_status: manifest.status,
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

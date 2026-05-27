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
        "local_runtime_executable_missing" => {
            "语音识别组件缺少可执行文件或安装不完整，请重新下载安装。".into()
        }
        "local_runtime_install_corrupt" => {
            "语音识别组件安装后校验仍异常，请重新下载安装或导出诊断包。".into()
        }
        "local_runtime_not_revalidatable" => {
            "当前安装元数据已损坏，无法直接重新验证。请先清除后重新下载安装。".into()
        }
        "local_runtime_not_restorable" => {
            "当前安装元数据已损坏，无法恢复上一版本。".into()
        }
        "local_runtime_no_previous" => "当前没有可恢复的上一版本侧车。".into(),
        "local_runtime_previous_missing" => "记录中的上一版本侧车目录已缺失，无法恢复。".into(),
        _ if error
            .strip_prefix("local_runtime_component_missing:")
            .is_some() =>
        {
            "当前 manifest 不包含本平台的语音识别组件。".into()
        }
        _ if error
            .strip_prefix("local_runtime_shell_version_incompatible:")
            .is_some() =>
        {
            "当前桌面端版本过低，无法安装该语音识别组件。请先升级应用。".into()
        }
        _ if error.strip_prefix("backup_runtime_failed:").is_some() => {
            "在切换新语音识别组件前备份当前版本失败，已中止升级。".into()
        }
        _ if error.strip_prefix("promote_runtime_failed:").is_some() => {
            "语音识别组件已下载，但切换到新版本时失败。当前版本未变更。".into()
        }
        _ if error.strip_prefix("create_local_runtime_root_failed:").is_some()
            || error.strip_prefix("create_extract_dir_failed:").is_some()
            || error.strip_prefix("create_dir_failed:").is_some()
            || error.strip_prefix("create_file_failed:").is_some()
            || error.strip_prefix("artifact_create_failed:").is_some()
            || error.strip_prefix("artifact_write_failed:").is_some() =>
        {
            "无法写入应用数据目录，请检查磁盘权限或剩余空间后重试。".into()
        }
        _ if error.strip_prefix("artifact_").is_some() => {
            "下载语音识别组件失败，请检查网络、镜像源或本地文件后重试。".into()
        }
        _ if error.strip_prefix("open_zip_failed:").is_some()
            || error.strip_prefix("read_zip_entry_failed:").is_some()
            || error.strip_prefix("extract_file_failed:").is_some()
            || error == "zip_path_traversal" =>
        {
            "下载到的语音识别组件压缩包无效，无法完成解压安装。".into()
        }
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
        ) =>
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
        assert!(describe_local_runtime_error("local_runtime_executable_missing").contains("可执行文件"));
        assert!(describe_local_runtime_error("local_runtime_component_missing:linux-x64").contains("本平台"));
        assert!(
            describe_local_runtime_error("local_runtime_shell_version_incompatible:0.1.0:0.2.0")
                .contains("版本过低")
        );
        assert!(describe_local_runtime_error("backup_runtime_failed:disk busy").contains("备份当前版本失败"));
        assert!(describe_local_runtime_error("promote_runtime_failed:rename").contains("切换到新版本时失败"));
        assert!(describe_local_runtime_error("artifact_http_500").contains("下载语音识别组件失败"));
        assert!(describe_local_runtime_error("open_zip_failed:bad zip").contains("压缩包无效"));
        assert!(describe_local_runtime_error("local_runtime_not_revalidatable").contains("元数据已损坏"));
    }
}

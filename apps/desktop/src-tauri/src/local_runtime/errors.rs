/// Stable local-runtime error codes surfaced to the desktop UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalRuntimeErrorCode {
    Cancelled,
    Sha256Mismatch,
    ExtractRejected,
    ExecutableMissing,
    InstallCorrupt,
    NotRevalidatable,
    NotRestorable,
    NoPrevious,
    PreviousMissing,
    ComponentMissing,
    ShellVersionIncompatible,
    BackupFailed,
    PromoteFailed,
    DiskWriteFailed,
    ArtifactFetchFailed,
    ZipInvalid,
    VerifyFailed,
    DiskSpaceLow,
    ManifestIssue,
    Unknown,
}

pub fn classify_local_runtime_error(error: &str) -> LocalRuntimeErrorCode {
    if crate::local_runtime::catalog::manifest_blocking_issue(error).is_some() {
        return LocalRuntimeErrorCode::ManifestIssue;
    }
    if error.starts_with("local_runtime_disk_space_low:") {
        return LocalRuntimeErrorCode::DiskSpaceLow;
    }
    match error {
        "cancelled" => LocalRuntimeErrorCode::Cancelled,
        "local_runtime_sha256_mismatch" => LocalRuntimeErrorCode::Sha256Mismatch,
        "local_runtime_extract_too_many_entries" | "local_runtime_extract_size_limit_exceeded" => {
            LocalRuntimeErrorCode::ExtractRejected
        }
        "local_runtime_executable_missing" => LocalRuntimeErrorCode::ExecutableMissing,
        "local_runtime_install_corrupt" => LocalRuntimeErrorCode::InstallCorrupt,
        "local_runtime_not_revalidatable" => LocalRuntimeErrorCode::NotRevalidatable,
        "local_runtime_not_restorable" => LocalRuntimeErrorCode::NotRestorable,
        "local_runtime_no_previous" => LocalRuntimeErrorCode::NoPrevious,
        "local_runtime_previous_missing" => LocalRuntimeErrorCode::PreviousMissing,
        "zip_path_traversal" => LocalRuntimeErrorCode::ZipInvalid,
        _ if error.starts_with("local_runtime_component_missing:") => {
            LocalRuntimeErrorCode::ComponentMissing
        }
        _ if error.starts_with("local_runtime_shell_version_incompatible:") => {
            LocalRuntimeErrorCode::ShellVersionIncompatible
        }
        _ if error.starts_with("backup_runtime_failed:") => LocalRuntimeErrorCode::BackupFailed,
        _ if error.starts_with("promote_runtime_failed:") => LocalRuntimeErrorCode::PromoteFailed,
        _ if error.starts_with("create_local_runtime_root_failed:")
            || error.starts_with("create_extract_dir_failed:")
            || error.starts_with("create_dir_failed:")
            || error.starts_with("create_file_failed:")
            || error.starts_with("artifact_create_failed:")
            || error.starts_with("artifact_write_failed:") =>
        {
            LocalRuntimeErrorCode::DiskWriteFailed
        }
        _ if error.starts_with("artifact_") => LocalRuntimeErrorCode::ArtifactFetchFailed,
        _ if error.starts_with("open_zip_failed:")
            || error.starts_with("read_zip_entry_failed:")
            || error.starts_with("extract_file_failed:") =>
        {
            LocalRuntimeErrorCode::ZipInvalid
        }
        _ if error.starts_with("local_runtime_verify_") => LocalRuntimeErrorCode::VerifyFailed,
        _ => LocalRuntimeErrorCode::Unknown,
    }
}

pub fn describe_local_runtime_error(error: &str) -> String {
    if let Some(message) = crate::local_runtime::catalog::manifest_blocking_issue(error) {
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
    match classify_local_runtime_error(error) {
        LocalRuntimeErrorCode::Cancelled => "已取消本机语音识别组件下载。".into(),
        LocalRuntimeErrorCode::Sha256Mismatch => {
            "下载到的语音识别组件校验失败（SHA256 不匹配），已拒绝安装。".into()
        }
        LocalRuntimeErrorCode::ExtractRejected => {
            "下载到的语音识别组件压缩包结构异常，已拒绝解压。".into()
        }
        LocalRuntimeErrorCode::ExecutableMissing => {
            "语音识别组件缺少可执行文件或安装不完整，请重新下载安装。".into()
        }
        LocalRuntimeErrorCode::InstallCorrupt => {
            "语音识别组件安装后校验仍异常，请重新下载安装或导出诊断包。".into()
        }
        LocalRuntimeErrorCode::NotRevalidatable => {
            "当前安装元数据已损坏，无法直接重新验证。请先清除后重新下载安装。".into()
        }
        LocalRuntimeErrorCode::NotRestorable => "当前安装元数据已损坏，无法恢复上一版本。".into(),
        LocalRuntimeErrorCode::NoPrevious => "当前没有可恢复的上一版本侧车。".into(),
        LocalRuntimeErrorCode::PreviousMissing => {
            "记录中的上一版本侧车目录已缺失，无法恢复。".into()
        }
        LocalRuntimeErrorCode::ComponentMissing => {
            "当前 manifest 不包含本平台的语音识别组件。".into()
        }
        LocalRuntimeErrorCode::ShellVersionIncompatible => {
            "当前桌面端版本过低，无法安装该语音识别组件。请先升级应用。".into()
        }
        LocalRuntimeErrorCode::BackupFailed => {
            "在切换新语音识别组件前备份当前版本失败，已中止升级。".into()
        }
        LocalRuntimeErrorCode::PromoteFailed => {
            "语音识别组件已下载，但切换到新版本时失败。当前版本未变更。".into()
        }
        LocalRuntimeErrorCode::DiskWriteFailed => {
            "无法写入应用数据目录，请检查磁盘权限或剩余空间后重试。".into()
        }
        LocalRuntimeErrorCode::ArtifactFetchFailed => {
            "下载语音识别组件失败，请检查网络、镜像源或本地文件后重试。".into()
        }
        LocalRuntimeErrorCode::ZipInvalid => {
            "下载到的语音识别组件压缩包无效，无法完成解压安装。".into()
        }
        LocalRuntimeErrorCode::VerifyFailed => {
            "语音识别组件已下载，但健康验证未通过。可尝试重新验证、恢复上一版或导出诊断包。".into()
        }
        LocalRuntimeErrorCode::DiskSpaceLow | LocalRuntimeErrorCode::ManifestIssue => {
            error.to_string()
        }
        LocalRuntimeErrorCode::Unknown => error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        classify_local_runtime_error, describe_local_runtime_error, LocalRuntimeErrorCode,
    };

    #[test]
    fn classifies_known_install_errors() {
        assert_eq!(
            classify_local_runtime_error("local_runtime_sha256_mismatch"),
            LocalRuntimeErrorCode::Sha256Mismatch
        );
        assert_eq!(
            classify_local_runtime_error("cancelled"),
            LocalRuntimeErrorCode::Cancelled
        );
        assert_eq!(
            classify_local_runtime_error("local_runtime_verify_timeout"),
            LocalRuntimeErrorCode::VerifyFailed
        );
    }

    #[test]
    fn maps_sha256_mismatch_to_user_message() {
        let msg = describe_local_runtime_error("local_runtime_sha256_mismatch");
        assert!(msg.contains("SHA256"));
    }
}

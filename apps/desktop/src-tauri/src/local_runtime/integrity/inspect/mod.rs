mod files;

#[cfg(test)]
mod tests;

use super::marker::parse_marker;
use super::paths::{local_runtime_root, marker_path, runtime_root_exists, version_dir};
use super::types::{InstalledRuntimeInfo, InstalledRuntimeStatus};
use files::inspect_runtime_files;
use std::fs;
use std::path::{Path, PathBuf};

pub fn inspect_installed_runtime(app_root: &Path) -> InstalledRuntimeInfo {
    let root = local_runtime_root(app_root);
    let default = InstalledRuntimeInfo {
        status: InstalledRuntimeStatus::Missing,
        version: None,
        previous_version: None,
        executable_path: None,
        root_dir: root.to_string_lossy().to_string(),
        detail: None,
        last_verify_error: None,
        last_install_phase: None,
    };
    let Ok(bytes) = fs::read(marker_path(app_root)) else {
        if runtime_root_exists(app_root) {
            return InstalledRuntimeInfo {
                status: InstalledRuntimeStatus::Corrupt,
                detail: Some("local runtime marker 缺失，请清除后重新下载安装组件。".into()),
                ..default
            };
        }
        return default;
    };
    let Ok(marker) = parse_marker(&bytes) else {
        return InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            detail: Some(
                parse_marker(&bytes)
                    .err()
                    .unwrap_or_else(|| "local runtime marker 无法解析".into()),
            ),
            ..default
        };
    };
    let install_root = version_dir(app_root, &marker.version);
    let exe = install_root.join(&marker.exe_relpath);
    match fs::metadata(&exe) {
        Ok(meta)
            if meta.is_file()
                && meta.len() > 1024
                && marker.verify_state.as_deref() == Some("corrupt") =>
        {
            InstalledRuntimeInfo {
                status: InstalledRuntimeStatus::Corrupt,
                version: Some(marker.version.clone()),
                previous_version: marker.previous_version.clone(),
                executable_path: Some(exe.to_string_lossy().to_string()),
                root_dir: root.to_string_lossy().to_string(),
                detail: Some(marker.last_verify_error.clone().unwrap_or_else(|| {
                    "local runtime 上次健康验证失败，请重新验证或重新下载安装组件。".into()
                })),
                last_verify_error: marker.last_verify_error.clone(),
                last_install_phase: marker.last_install_phase.clone(),
            }
        }
        Ok(meta) if meta.is_file() && meta.len() > 1024 => match inspect_runtime_files(&exe) {
            Ok(()) => InstalledRuntimeInfo {
                status: InstalledRuntimeStatus::Installed,
                version: Some(marker.version.clone()),
                previous_version: marker.previous_version.clone(),
                executable_path: Some(exe.to_string_lossy().to_string()),
                root_dir: root.to_string_lossy().to_string(),
                detail: None,
                last_verify_error: marker.last_verify_error.clone(),
                last_install_phase: marker.last_install_phase.clone(),
            },
            Err(detail) => InstalledRuntimeInfo {
                status: InstalledRuntimeStatus::Corrupt,
                version: Some(marker.version.clone()),
                previous_version: marker.previous_version.clone(),
                executable_path: Some(exe.to_string_lossy().to_string()),
                root_dir: root.to_string_lossy().to_string(),
                detail: Some(detail),
                last_verify_error: marker.last_verify_error.clone(),
                last_install_phase: marker.last_install_phase.clone(),
            },
        },
        Ok(_) => InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            version: Some(marker.version.clone()),
            previous_version: marker.previous_version.clone(),
            executable_path: Some(exe.to_string_lossy().to_string()),
            root_dir: root.to_string_lossy().to_string(),
            detail: Some("local runtime 可执行文件过小或不可执行".into()),
            last_verify_error: marker.last_verify_error.clone(),
            last_install_phase: marker.last_install_phase.clone(),
        },
        Err(e) => InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            version: Some(marker.version.clone()),
            previous_version: marker.previous_version.clone(),
            executable_path: Some(exe.to_string_lossy().to_string()),
            root_dir: root.to_string_lossy().to_string(),
            detail: Some(format!("local runtime 可执行文件缺失: {e}")),
            last_verify_error: marker.last_verify_error.clone(),
            last_install_phase: marker.last_install_phase.clone(),
        },
    }
}

pub fn resolve_installed_executable(app_root: &Path) -> Option<PathBuf> {
    let info = inspect_installed_runtime(app_root);
    if info.status == InstalledRuntimeStatus::Installed {
        info.executable_path.map(PathBuf::from)
    } else {
        None
    }
}

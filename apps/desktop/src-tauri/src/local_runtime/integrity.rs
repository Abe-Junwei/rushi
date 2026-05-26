use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

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
    pub executable_path: Option<String>,
    pub root_dir: String,
    pub detail: Option<String>,
}

pub fn local_runtime_root(app_root: &Path) -> PathBuf {
    app_root.join("local_runtime").join("asr-sidecar")
}

pub fn version_dir(app_root: &Path, version: &str) -> PathBuf {
    local_runtime_root(app_root).join(version)
}

pub fn marker_path(app_root: &Path) -> PathBuf {
    local_runtime_root(app_root).join("current.json")
}

pub fn write_marker(app_root: &Path, version: &str, exe_relpath: &str) -> Result<(), String> {
    let root = local_runtime_root(app_root);
    fs::create_dir_all(&root).map_err(|e| format!("创建 local runtime 根目录失败: {e}"))?;
    let body = serde_json::json!({
        "version": version,
        "exe_relpath": exe_relpath,
    });
    fs::write(marker_path(app_root), serde_json::to_vec_pretty(&body).map_err(|e| e.to_string())?)
        .map_err(|e| format!("写入 local runtime marker 失败: {e}"))
}

pub fn inspect_installed_runtime(app_root: &Path) -> InstalledRuntimeInfo {
    let root = local_runtime_root(app_root);
    let default = InstalledRuntimeInfo {
        status: InstalledRuntimeStatus::Missing,
        version: None,
        executable_path: None,
        root_dir: root.to_string_lossy().to_string(),
        detail: None,
    };
    let Ok(bytes) = fs::read(marker_path(app_root)) else {
        return default;
    };
    let Ok(marker) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            detail: Some("local runtime marker 无法解析".into()),
            ..default
        };
    };
    let Some(version) = marker.get("version").and_then(|v| v.as_str()) else {
        return InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            detail: Some("local runtime marker 缺少 version".into()),
            ..default
        };
    };
    let Some(exe_relpath) = marker.get("exe_relpath").and_then(|v| v.as_str()) else {
        return InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            detail: Some("local runtime marker 缺少 exe_relpath".into()),
            ..default
        };
    };
    let install_root = version_dir(app_root, version);
    let exe = install_root.join(exe_relpath);
    match fs::metadata(&exe) {
        Ok(meta) if meta.is_file() && meta.len() > 1024 => InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Installed,
            version: Some(version.to_string()),
            executable_path: Some(exe.to_string_lossy().to_string()),
            root_dir: root.to_string_lossy().to_string(),
            detail: None,
        },
        Ok(_) => InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            version: Some(version.to_string()),
            executable_path: Some(exe.to_string_lossy().to_string()),
            root_dir: root.to_string_lossy().to_string(),
            detail: Some("local runtime 可执行文件过小或不可执行".into()),
        },
        Err(e) => InstalledRuntimeInfo {
            status: InstalledRuntimeStatus::Corrupt,
            version: Some(version.to_string()),
            executable_path: Some(exe.to_string_lossy().to_string()),
            root_dir: root.to_string_lossy().to_string(),
            detail: Some(format!("local runtime 可执行文件缺失: {e}")),
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

#[cfg(test)]
mod tests {
    use super::{inspect_installed_runtime, local_runtime_root, write_marker, InstalledRuntimeStatus};
    use std::fs;
    use uuid::Uuid;

    fn temp_root() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("rushi-local-runtime-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn inspect_runtime_reports_missing_by_default() {
        let root = temp_root();
        let info = inspect_installed_runtime(&root);
        assert_eq!(info.status, InstalledRuntimeStatus::Missing);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn inspect_runtime_reports_installed_when_marker_and_exe_exist() {
        let root = temp_root();
        let exe_relpath = "rushi-asr-sidecar/rushi-asr-sidecar";
        let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, vec![0_u8; 2048]).unwrap();
        write_marker(&root, "0.1.0", exe_relpath).unwrap();
        let info = inspect_installed_runtime(&root);
        assert_eq!(info.status, InstalledRuntimeStatus::Installed);
        let _ = fs::remove_dir_all(&root);
    }
}

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

pub fn local_runtime_root(app_root: &Path) -> PathBuf {
    app_root.join("local_runtime").join("asr-sidecar")
}

pub fn version_dir(app_root: &Path, version: &str) -> PathBuf {
    local_runtime_root(app_root).join(version)
}

pub fn marker_path(app_root: &Path) -> PathBuf {
    local_runtime_root(app_root).join("current.json")
}

pub fn runtime_root_exists(app_root: &Path) -> bool {
    local_runtime_root(app_root).exists()
}

fn parse_marker(bytes: &[u8]) -> Result<InstalledRuntimeMarker, String> {
    let marker = serde_json::from_slice::<serde_json::Value>(bytes)
        .map_err(|_| "local runtime marker 无法解析".to_string())?;
    let version = marker
        .get("version")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "local runtime marker 缺少 version".to_string())?;
    let exe_relpath = marker
        .get("exe_relpath")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "local runtime marker 缺少 exe_relpath".to_string())?;
    let verify_state = marker
        .get("verify_state")
        .and_then(|v| v.as_str())
        .map(|value| value.to_string());
    let previous_version = marker
        .get("previous_version")
        .and_then(|v| v.as_str())
        .map(|value| value.to_string());
    let previous_exe_relpath = marker
        .get("previous_exe_relpath")
        .and_then(|v| v.as_str())
        .map(|value| value.to_string());
    let last_verify_error = marker
        .get("last_verify_error")
        .and_then(|v| v.as_str())
        .map(|value| value.to_string());
    let last_install_phase = marker
        .get("last_install_phase")
        .and_then(|v| v.as_str())
        .map(|value| value.to_string());
    Ok(InstalledRuntimeMarker {
        version: version.to_string(),
        exe_relpath: exe_relpath.to_string(),
        verify_state,
        previous_version,
        previous_exe_relpath,
        last_verify_error,
        last_install_phase,
    })
}

pub fn read_marker(app_root: &Path) -> Result<InstalledRuntimeMarker, String> {
    let bytes = fs::read(marker_path(app_root))
        .map_err(|e| format!("读取 local runtime marker 失败: {e}"))?;
    parse_marker(&bytes)
}

fn required_runtime_files(exe: &Path) -> Vec<(&'static str, PathBuf)> {
    let runtime_dir = exe.parent().unwrap_or(exe);
    let internal_dir = runtime_dir.join("_internal");
    #[cfg(target_os = "windows")]
    let ffmpeg = internal_dir.join("ffmpeg.exe");
    #[cfg(not(target_os = "windows"))]
    let ffmpeg = internal_dir.join("ffmpeg");
    #[cfg(target_os = "windows")]
    let ffprobe = internal_dir.join("ffprobe.exe");
    #[cfg(not(target_os = "windows"))]
    let ffprobe = internal_dir.join("ffprobe");

    vec![
        (
            "FunASR 资源",
            internal_dir.join("funasr").join("version.txt"),
        ),
        ("FFmpeg", ffmpeg),
        ("FFprobe", ffprobe),
    ]
}

fn inspect_runtime_files(exe: &Path) -> Result<(), String> {
    for (label, path) in required_runtime_files(exe) {
        match fs::metadata(&path) {
            Ok(meta) if meta.is_file() && meta.len() > 0 => {}
            Ok(_) => {
                return Err(format!("{label} 文件异常: {}", path.to_string_lossy()));
            }
            Err(e) => {
                return Err(format!("{label} 缺失: {} ({e})", path.to_string_lossy()));
            }
        }
    }
    Ok(())
}

fn write_marker_with_state(
    app_root: &Path,
    version: &str,
    exe_relpath: &str,
    verify_state: Option<&str>,
    previous: Option<(&str, &str)>,
    last_verify_error: Option<&str>,
    last_install_phase: Option<&str>,
) -> Result<(), String> {
    let root = local_runtime_root(app_root);
    fs::create_dir_all(&root).map_err(|e| format!("创建 local runtime 根目录失败: {e}"))?;
    let body = serde_json::json!({
        "version": version,
        "exe_relpath": exe_relpath,
        "verify_state": verify_state,
        "previous_version": previous.map(|(version, _)| version),
        "previous_exe_relpath": previous.map(|(_, exe_relpath)| exe_relpath),
        "last_verify_error": last_verify_error,
        "last_install_phase": last_install_phase,
    });
    fs::write(
        marker_path(app_root),
        serde_json::to_vec_pretty(&body).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("写入 local runtime marker 失败: {e}"))
}

#[allow(dead_code)]
pub fn write_marker(app_root: &Path, version: &str, exe_relpath: &str) -> Result<(), String> {
    write_marker_with_state(
        app_root,
        version,
        exe_relpath,
        Some("ok"),
        None,
        None,
        Some("ready"),
    )
}

pub fn write_marker_with_previous(
    app_root: &Path,
    version: &str,
    exe_relpath: &str,
    previous: Option<(&str, &str)>,
    last_install_phase: Option<&str>,
) -> Result<(), String> {
    write_marker_with_state(
        app_root,
        version,
        exe_relpath,
        Some("ok"),
        previous,
        None,
        last_install_phase,
    )
}

pub fn mark_runtime_corrupt(
    app_root: &Path,
    marker: &InstalledRuntimeMarker,
    verify_error: Option<&str>,
    last_install_phase: Option<&str>,
) -> Result<(), String> {
    write_marker_with_state(
        app_root,
        &marker.version,
        &marker.exe_relpath,
        Some("corrupt"),
        marker
            .previous_version
            .as_deref()
            .zip(marker.previous_exe_relpath.as_deref()),
        verify_error,
        last_install_phase,
    )
}

pub fn clear_installed_runtime(app_root: &Path) -> Result<(), String> {
    let root = local_runtime_root(app_root);
    if !root.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&root).map_err(|e| format!("清除 local runtime 失败: {e}"))
}

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

#[cfg(test)]
mod tests {
    use super::{
        clear_installed_runtime, inspect_installed_runtime, local_runtime_root,
        mark_runtime_corrupt, read_marker, runtime_root_exists, write_marker,
        write_marker_with_previous, InstalledRuntimeStatus,
    };
    use std::fs;
    use uuid::Uuid;

    fn write_runtime_payload(runtime_dir: &std::path::Path) {
        let internal = runtime_dir.join("_internal");
        fs::create_dir_all(internal.join("funasr")).unwrap();
        fs::write(internal.join("funasr").join("version.txt"), b"1.0.0").unwrap();
        #[cfg(target_os = "windows")]
        fs::write(internal.join("ffmpeg.exe"), b"ffmpeg").unwrap();
        #[cfg(not(target_os = "windows"))]
        fs::write(internal.join("ffmpeg"), b"ffmpeg").unwrap();
        #[cfg(target_os = "windows")]
        fs::write(internal.join("ffprobe.exe"), b"ffprobe").unwrap();
        #[cfg(not(target_os = "windows"))]
        fs::write(internal.join("ffprobe"), b"ffprobe").unwrap();
    }

    fn temp_root() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("rushi-local-runtime-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[cfg(target_os = "windows")]
    fn test_exe_relpath() -> &'static str {
        "rushi-asr-sidecar/rushi-asr-sidecar.exe"
    }

    #[cfg(not(target_os = "windows"))]
    fn test_exe_relpath() -> &'static str {
        "rushi-asr-sidecar/rushi-asr-sidecar"
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
        let exe_relpath = test_exe_relpath();
        let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, vec![0_u8; 2048]).unwrap();
        write_runtime_payload(exe.parent().unwrap());
        write_marker(&root, "0.1.0", exe_relpath).unwrap();
        let info = inspect_installed_runtime(&root);
        assert_eq!(info.status, InstalledRuntimeStatus::Installed);
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn inspect_runtime_reports_corrupt_when_funasr_payload_missing() {
        let root = temp_root();
        let exe_relpath = test_exe_relpath();
        let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, vec![0_u8; 2048]).unwrap();
        let internal = exe.parent().unwrap().join("_internal");
        fs::create_dir_all(&internal).unwrap();
        #[cfg(target_os = "windows")]
        fs::write(internal.join("ffmpeg.exe"), b"ffmpeg").unwrap();
        #[cfg(not(target_os = "windows"))]
        fs::write(internal.join("ffmpeg"), b"ffmpeg").unwrap();
        #[cfg(target_os = "windows")]
        fs::write(internal.join("ffprobe.exe"), b"ffprobe").unwrap();
        #[cfg(not(target_os = "windows"))]
        fs::write(internal.join("ffprobe"), b"ffprobe").unwrap();
        write_marker(&root, "0.1.0", exe_relpath).unwrap();

        let info = inspect_installed_runtime(&root);
        assert_eq!(info.status, InstalledRuntimeStatus::Corrupt);
        assert!(info.detail.unwrap_or_default().contains("FunASR"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn inspect_runtime_reports_corrupt_when_marker_marked_failed_verify() {
        let root = temp_root();
        let exe_relpath = test_exe_relpath();
        let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, vec![0_u8; 2048]).unwrap();
        write_runtime_payload(exe.parent().unwrap());
        write_marker(&root, "0.1.0", exe_relpath).unwrap();
        let marker = read_marker(&root).unwrap();
        mark_runtime_corrupt(
            &root,
            &marker,
            Some("local_runtime_verify_health_incomplete"),
            Some("verifying"),
        )
        .unwrap();

        let info = inspect_installed_runtime(&root);
        assert_eq!(info.status, InstalledRuntimeStatus::Corrupt);
        assert!(info
            .detail
            .unwrap_or_default()
            .contains("local_runtime_verify_health_incomplete"));
        assert_eq!(info.last_install_phase.as_deref(), Some("verifying"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn inspect_runtime_exposes_previous_version_from_marker() {
        let root = temp_root();
        let exe_relpath = test_exe_relpath();
        let exe = local_runtime_root(&root).join("0.2.0").join(exe_relpath);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, vec![0_u8; 2048]).unwrap();
        write_runtime_payload(exe.parent().unwrap());
        write_marker_with_previous(
            &root,
            "0.2.0",
            exe_relpath,
            Some(("0.1.0", exe_relpath)),
            Some("ready"),
        )
        .unwrap();

        let info = inspect_installed_runtime(&root);
        assert_eq!(info.status, InstalledRuntimeStatus::Installed);
        assert_eq!(info.previous_version.as_deref(), Some("0.1.0"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn clear_installed_runtime_removes_runtime_root() {
        let root = temp_root();
        let exe_relpath = test_exe_relpath();
        let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, vec![0_u8; 2048]).unwrap();
        write_runtime_payload(exe.parent().unwrap());
        write_marker(&root, "0.1.0", exe_relpath).unwrap();

        clear_installed_runtime(&root).unwrap();
        assert!(!local_runtime_root(&root).exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn inspect_runtime_reports_corrupt_when_marker_missing_but_root_exists() {
        let root = temp_root();
        fs::create_dir_all(local_runtime_root(&root).join("orphaned")).unwrap();
        let info = inspect_installed_runtime(&root);
        assert_eq!(info.status, InstalledRuntimeStatus::Corrupt);
        assert!(info.detail.unwrap_or_default().contains("marker 缺失"));
        assert!(runtime_root_exists(&root));
        let _ = fs::remove_dir_all(&root);
    }
}

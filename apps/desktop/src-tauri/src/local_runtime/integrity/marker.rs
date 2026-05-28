use super::paths::{local_runtime_root, marker_path};
use super::types::InstalledRuntimeMarker;
use std::fs;
use std::path::Path;

pub(crate) fn parse_marker(bytes: &[u8]) -> Result<InstalledRuntimeMarker, String> {
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

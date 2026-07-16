use std::path::{Path, PathBuf};

use crate::project::app_data_paths::resolve_app_data_root;

pub fn cuda_sidecar_install_dir(app_data_root: &Path) -> PathBuf {
    resolve_app_data_root(app_data_root.to_path_buf())
        .join("bundled-asr")
        .join("rushi-asr-sidecar-cuda")
}

pub fn cuda_downloads_dir(app_data_root: &Path) -> PathBuf {
    resolve_app_data_root(app_data_root.to_path_buf())
        .join("bundled-asr")
        .join("cuda-sidecar")
        .join("downloads")
}

pub fn cuda_staging_root(app_data_root: &Path) -> PathBuf {
    resolve_app_data_root(app_data_root.to_path_buf())
        .join("bundled-asr")
        .join("cuda-sidecar")
        .join("staging")
}

pub fn cuda_version_marker_path(app_data_root: &Path) -> PathBuf {
    cuda_sidecar_install_dir(app_data_root).join("rushi-cuda-install-version.txt")
}

pub fn read_cuda_installed_version(app_data_root: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(cuda_version_marker_path(app_data_root)).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub fn write_cuda_installed_version(app_data_root: &Path, version: &str) -> Result<(), String> {
    let path = cuda_version_marker_path(app_data_root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("asr_cuda_version_dir_failed: {e}"))?;
    }
    std::fs::write(&path, format!("{}\n", version.trim()))
        .map_err(|e| format!("asr_cuda_version_write_failed: {e}"))
}

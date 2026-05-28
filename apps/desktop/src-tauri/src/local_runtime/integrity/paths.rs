use std::path::{Path, PathBuf};

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

//! Scoped waveform media / peaks path checks (parity probes — no IPC byte transfer).

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::DbState;

pub(crate) fn resolve_scoped_waveform_path(root: &Path, path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("路径为空".into());
    }
    let pb = PathBuf::from(trimmed);
    if pb.is_symlink() {
        return Err("拒绝读取：路径为符号链接".into());
    }
    let root_can = fs::canonicalize(root).map_err(|e| format!("无法解析应用数据根目录: {e}"))?;
    let file_can = fs::canonicalize(&pb).map_err(|e| format!("无法解析文件路径: {e}"))?;
    if file_can.strip_prefix(&root_can).is_err() {
        return Err("拒绝读取：文件不在应用数据根之下".into());
    }
    if !file_can.is_file() {
        return Err("文件不存在或不是普通文件".into());
    }
    Ok(file_can)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopedWaveformFileMeta {
    pub disk_bytes: u64,
}

/// Disk byte length for parity probe (compare with WebView `fetch(asset://)`).
#[tauri::command]
pub fn scoped_waveform_file_meta(
    state: tauri::State<DbState>,
    path: String,
) -> Result<ScopedWaveformFileMeta, String> {
    let file_path = resolve_scoped_waveform_path(&state.root, &path)?;
    let meta = fs::metadata(&file_path).map_err(|e| format!("读取文件元数据失败: {e}"))?;
    if meta.file_type().is_symlink() {
        return Err("拒绝读取：文件为符号链接".into());
    }
    Ok(ScopedWaveformFileMeta {
        disk_bytes: meta.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn rejects_path_outside_app_data_root() {
        let root = std::env::temp_dir().join(format!("rushi-wf-scope-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let outside = std::env::temp_dir().join(format!("rushi-wf-out-{}", Uuid::new_v4()));
        fs::write(&outside, b"x").unwrap();
        let err = resolve_scoped_waveform_path(&root, outside.to_str().unwrap()).unwrap_err();
        assert!(err.contains("应用数据根"));
        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn reads_file_under_root() {
        let root = std::env::temp_dir().join(format!("rushi-wf-in-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let file = root.join("a.dat");
        fs::write(&file, b"peaks").unwrap();
        let resolved = resolve_scoped_waveform_path(&root, file.to_str().unwrap()).unwrap();
        assert!(resolved.is_file());
        let _ = fs::remove_dir_all(root);
    }
}

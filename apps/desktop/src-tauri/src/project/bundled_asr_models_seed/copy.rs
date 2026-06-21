//! File-system copy helpers for bundled ASR models seed.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use super::progress::emit_progress;
use tauri::AppHandle;

const COPY_PROGRESS_CHUNK_BYTES: u64 = 8 * 1024 * 1024;
const COPY_IO_BUFFER_BYTES: usize = 1024 * 1024;

pub fn ensure_safe_copy_destination(dest: &Path) -> Result<(), String> {
    if dest.exists() {
        let meta = fs::symlink_metadata(dest).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("目标路径为符号链接，拒绝写入。".to_string());
        }
    }
    Ok(())
}

pub fn dir_file_bytes(root: &Path) -> Result<u64, String> {
    if !root.is_dir() {
        return Ok(0);
    }
    let mut total = 0_u64;
    for entry in fs::read_dir(root).map_err(|e| format!("读取目录失败: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err(format!(
                "内置模型包含符号链接（{}），请重新安装应用。",
                path.display()
            ));
        }
        if meta.is_dir() {
            total = total.saturating_add(dir_file_bytes(&path)?);
        } else if meta.is_file() {
            total = total.saturating_add(meta.len());
        }
    }
    Ok(total)
}

pub struct CopyProgress<'a> {
    app: Option<&'a AppHandle>,
    phase: &'a str,
    copied: u64,
    total: u64,
}

impl<'a> CopyProgress<'a> {
    pub fn new(app: Option<&'a AppHandle>, phase: &'a str, total: u64) -> Self {
        Self {
            app,
            phase,
            copied: 0,
            total: total.max(1),
        }
    }

    pub fn bump(&mut self, bytes: u64) {
        self.copied = self.copied.saturating_add(bytes);
        emit_progress(self.app, self.phase, self.copied, self.total);
    }
}

pub fn copy_file_with_progress(
    src: &Path,
    dest: &Path,
    file_size: u64,
    progress: &mut CopyProgress<'_>,
) -> Result<(), String> {
    ensure_safe_copy_destination(dest)?;
    let mut src_file = File::open(src).map_err(|e| format!("打开源文件失败: {e}"))?;
    let mut dest_file = File::create(dest).map_err(|e| format!("创建目标文件失败: {e}"))?;
    let mut buf = vec![0_u8; COPY_IO_BUFFER_BYTES];
    let mut copied_in_file = 0_u64;
    let mut since_last_emit = 0_u64;
    loop {
        let read = src_file
            .read(&mut buf)
            .map_err(|e| format!("读取源文件失败: {e}"))?;
        if read == 0 {
            break;
        }
        dest_file
            .write_all(&buf[..read])
            .map_err(|e| format!("写入目标文件失败: {e}"))?;
        copied_in_file = copied_in_file.saturating_add(read as u64);
        since_last_emit = since_last_emit.saturating_add(read as u64);
        if since_last_emit >= COPY_PROGRESS_CHUNK_BYTES || copied_in_file >= file_size {
            progress.bump(since_last_emit);
            since_last_emit = 0;
        }
    }
    if since_last_emit > 0 {
        progress.bump(since_last_emit);
    }
    Ok(())
}

pub fn copy_dir_recursive(
    src: &Path,
    dest: &Path,
    progress: &mut CopyProgress<'_>,
    rollback: &mut Vec<PathBuf>,
) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("内置模型缺少目录: {}", src.display()));
    }
    if dest.exists() {
        let meta = fs::symlink_metadata(dest).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("目标路径为符号链接，拒绝写入。".to_string());
        }
    }
    fs::create_dir_all(dest).map_err(|e| format!("创建目录失败: {e}"))?;
    for entry in fs::read_dir(src).map_err(|e| format!("读取目录失败: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        let meta = fs::symlink_metadata(&src_path).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("内置模型包含符号链接，请重新安装应用。".to_string());
        }
        if meta.is_dir() {
            copy_dir_recursive(&src_path, &dest_path, progress, rollback)?;
        } else if meta.is_file() {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let existed = dest_path
                .exists()
                && fs::symlink_metadata(&dest_path)
                    .map(|m| !m.file_type().is_symlink())
                    .unwrap_or(false);
            copy_file_with_progress(&src_path, &dest_path, meta.len(), progress)?;
            if !existed {
                rollback.push(dest_path);
            }
        }
    }
    Ok(())
}

pub fn copy_modelscope_tree(
    source_root: &Path,
    dest_root: &Path,
    app: Option<&AppHandle>,
    phase: &str,
    rollback: &mut Vec<PathBuf>,
) -> Result<u64, String> {
    let src = source_root.join("modelscope");
    if !src.is_dir() {
        return Err("内置模型缺少 modelscope/ 目录。".to_string());
    }
    let total = dir_file_bytes(&src)?;
    let mut progress = CopyProgress::new(app, phase, total);
    copy_dir_recursive(&src, dest_root, &mut progress, rollback)?;
    Ok(progress.copied)
}

pub fn rollback_new_files(paths: &[PathBuf], boundary: &Path) {
    for path in paths.iter().rev() {
        if path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
    let mut dirs: Vec<PathBuf> = paths
        .iter()
        .filter_map(|path| path.parent().map(|parent| parent.to_path_buf()))
        .collect();
    dirs.sort_by_key(|dir| std::cmp::Reverse(dir.components().count()));
    dirs.dedup();
    for dir in dirs {
        if !dir.starts_with(boundary) {
            continue;
        }
        let is_empty = dir
            .read_dir()
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);
        if is_empty {
            let _ = fs::remove_dir(&dir);
        }
    }
}

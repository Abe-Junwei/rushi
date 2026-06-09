use std::path::{Path, PathBuf};

use super::hash::file_sha256_hex;
use super::types::{ImportProvenance, SourceFileMeta};

pub fn normalize_import_source_path(raw: &str) -> String {
    let path = PathBuf::from(raw);
    std::fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| raw.trim().to_string())
}

pub fn source_file_meta(path: &Path) -> Result<SourceFileMeta, String> {
    let meta = fs_metadata(path)?;
    let modified_ms = meta
        .modified()
        .map_err(|e| format!("读取文件时间失败: {e}"))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("读取文件时间失败: {e}"))?
        .as_millis() as i64;
    Ok(SourceFileMeta {
        size: meta.len() as i64,
        modified_ms,
    })
}

fn fs_metadata(path: &Path) -> Result<std::fs::Metadata, String> {
    std::fs::metadata(path).map_err(|e| format!("读取文件失败: {e}"))
}

pub fn import_provenance_for_src(src_path: &str) -> Result<ImportProvenance, String> {
    let path = PathBuf::from(src_path);
    if !path.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let meta = source_file_meta(&path)?;
    Ok(ImportProvenance {
        source_path: normalize_import_source_path(src_path),
        content_sha256: file_sha256_hex(&path)?,
        source_size: meta.size,
        source_modified_ms: meta.modified_ms,
    })
}

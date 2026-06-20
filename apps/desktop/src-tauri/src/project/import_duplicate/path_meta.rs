use std::path::{Path, PathBuf};

use super::hash::file_sha256_hex;
use super::types::{ImportProvenance, SourceFileMeta};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportFileKind {
    Audio,
    Text,
}

/** 与桌面端 `importFileDisplayName` 一致：源路径去扩展名，用作项目内文件显示名。 */
pub fn import_file_display_name(src_path: &str, kind: ImportFileKind) -> String {
    let file_name = Path::new(src_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let without_ext = file_name
        .rsplit_once('.')
        .map(|(stem, _ext)| stem)
        .unwrap_or(file_name);
    let trimmed = without_ext.trim();
    if !trimmed.is_empty() {
        return trimmed.to_string();
    }
    match kind {
        ImportFileKind::Audio => "未命名音频".to_string(),
        ImportFileKind::Text => "未命名文本".to_string(),
    }
}

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

#[cfg(test)]
mod tests {
    use super::{import_file_display_name, ImportFileKind};

    #[test]
    fn import_file_display_name_uses_source_stem() {
        assert_eq!(
            import_file_display_name("/tmp/采访 A.wav", ImportFileKind::Audio),
            "采访 A"
        );
        assert_eq!(
            import_file_display_name("/clips/note.txt", ImportFileKind::Text),
            "note"
        );
    }

    #[test]
    fn import_file_display_name_falls_back_when_empty() {
        assert_eq!(
            import_file_display_name(".wav", ImportFileKind::Audio),
            "未命名音频"
        );
    }
}

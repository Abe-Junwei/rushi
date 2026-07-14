use super::types::{FileDetail, FileSummary, ProjectDetail, SegmentDto};
use crate::DbState;
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{params, Connection};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .expect("system time before UNIX_EPOCH")
}

static DESKTOP_LOG_MUTEX: Mutex<()> = Mutex::new(());
const DESKTOP_LOG_MAX_BYTES: u64 = 10 * 1024 * 1024;

pub fn append_desktop_log_line(st: &DbState, line: &str) {
    let _g = DESKTOP_LOG_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    let dir = st.root.join("logs");
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("desktop.log");
    if let Ok(meta) = fs::metadata(&path) {
        if meta.len() > DESKTOP_LOG_MAX_BYTES {
            let rotated = dir.join("desktop.log.1");
            let _ = fs::rename(&path, &rotated);
        }
    }
    let ts = now_ms();
    let clean = crate::utils::redact_secrets_for_log(line).replace(['\n', '\r'], " ");
    let line_bytes = format!("{ts}\t{clean}\n");
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(line_bytes.as_bytes());
    }
}

pub fn open_db(state: &DbState) -> Result<PooledConnection<SqliteConnectionManager>, String> {
    state.pool().get().map_err(|e| e.to_string())
}

type ProjectMetaRow = (
    String,
    i64,
    i64,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

pub fn project_detail_from_conn(
    conn: &Connection,
    project_id: &str,
) -> Result<ProjectDetail, String> {
    let (name, c_ms, u_ms, narrator, recorded_at, location, subject, transcriber): ProjectMetaRow = conn
        .query_row(
            "SELECT name, created_at_ms, updated_at_ms, narrator, recorded_at, location, subject, transcriber \
             FROM projects WHERE id = ?1",
            params![project_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, file_type, updated_at_ms FROM files WHERE project_id = ?1 ORDER BY created_at_ms ASC",
        )
        .map_err(|e| e.to_string())?;
    let file_rows = stmt
        .query_map(params![project_id], |r| {
            Ok(FileSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                file_type: r.get(2)?,
                updated_at_ms: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for f in file_rows {
        files.push(f.map_err(|e| e.to_string())?);
    }

    Ok(ProjectDetail {
        id: project_id.to_string(),
        name,
        files,
        created_at_ms: c_ms,
        updated_at_ms: u_ms,
        narrator,
        recorded_at,
        location,
        subject,
        transcriber,
    })
}

pub fn file_detail_from_conn(conn: &Connection, file_id: &str) -> Result<FileDetail, String> {
    let (project_id, name, file_type, audio_path, c_ms, u_ms): (
        String,
        String,
        String,
        Option<String>,
        i64,
        i64,
    ) = conn
        .query_row(
            "SELECT project_id, name, file_type, audio_path, created_at_ms, updated_at_ms FROM files WHERE id = ?1",
            params![file_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail, kind, \
             text_stage, finalize_via, annotation, frozen \
             FROM segments WHERE file_id = ?1 ORDER BY idx ASC",
        )
        .map_err(|e| e.to_string())?;
    let segs = stmt
        .query_map(params![file_id], |r| {
            let uid: String = r.get(0)?;
            let detail: String = r.get(7)?;
            let kind: Option<String> = r.get(8)?;
            let text_stage: String = r.get(9)?;
            let finalize_via: Option<String> = r.get(10)?;
            let annotation: String = r.get(11)?;
            let frozen: i64 = r.get(12)?;
            Ok(SegmentDto {
                uid: if uid.trim().is_empty() {
                    None
                } else {
                    Some(uid)
                },
                idx: r.get(1)?,
                start_sec: r.get(2)?,
                end_sec: r.get(3)?,
                text: r.get(4)?,
                confidence: r.get(5)?,
                low_confidence: r.get::<_, i64>(6)? != 0,
                detail: if detail.is_empty() {
                    None
                } else {
                    Some(detail)
                },
                kind: kind.filter(|s| !s.trim().is_empty()),
                text_stage: if text_stage.trim().is_empty() {
                    "auto_transcribe".to_string()
                } else {
                    text_stage
                },
                finalize_via: finalize_via.filter(|s| !s.trim().is_empty()),
                annotation: if annotation.trim().is_empty() {
                    None
                } else {
                    Some(annotation)
                },
                frozen: frozen != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut segments = Vec::new();
    for s in segs {
        segments.push(s.map_err(|e| e.to_string())?);
    }

    Ok(FileDetail {
        id: file_id.to_string(),
        project_id,
        name,
        file_type,
        audio_path,
        segments,
        created_at_ms: c_ms,
        updated_at_ms: u_ms,
    })
}

pub fn is_sqlite_unique_violation(err: &rusqlite::Error) -> bool {
    /// `SQLITE_CONSTRAINT_UNIQUE` (see sqlite.org/rescode.html)
    const SQLITE_CONSTRAINT_UNIQUE: i32 = 2067;
    matches!(
        err,
        rusqlite::Error::SqliteFailure(sqlite_err, _) if sqlite_err.extended_code == SQLITE_CONSTRAINT_UNIQUE
    )
}

/// 仅删除单个音频文件；若文件所在目录变为空，则一并删除该目录。
pub fn remove_audio_file(root: &Path, audio_storage_path: &str) -> Result<(), String> {
    let pb = PathBuf::from(audio_storage_path);
    if !pb.exists() {
        return Ok(());
    }
    let sm = fs::symlink_metadata(&pb).map_err(|e| format!("无法读取音频文件元数据: {e}"))?;
    if sm.file_type().is_symlink() {
        return Err("拒绝删除：音频文件为符号链接，请先移除链接。".into());
    }
    let root_can = fs::canonicalize(root).map_err(|e| format!("无法解析应用数据根目录: {e}"))?;
    let file_can = fs::canonicalize(&pb).map_err(|e| format!("无法解析音频文件路径: {e}"))?;
    if file_can.strip_prefix(&root_can).is_err() {
        return Err("拒绝删除：音频文件不在应用数据根之下。".into());
    }
    fs::remove_file(&file_can).map_err(|e| format!("删除音频文件失败: {e}"))?;

    // 若父目录为空则清理
    if let Some(parent) = file_can.parent() {
        if parent.exists() {
            if let Ok(mut entries) = fs::read_dir(parent) {
                if entries.next().is_none() {
                    let _ = fs::remove_dir(parent);
                }
            }
        }
    }
    Ok(())
}

/// Absolute canonical path for persisting in `files.audio_path`.
pub fn canonicalize_audio_storage_path(path: &Path) -> Result<String, String> {
    let canonical = fs::canonicalize(path)
        .map_err(|e| format!("无法规范化音频路径 ({}): {e}", path.display()))?;
    Ok(canonical.to_string_lossy().to_string())
}

pub fn resolve_audio_path_under_root(root: &Path, raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("音频路径为空".into());
    }
    let pb = PathBuf::from(trimmed);
    let sm = fs::symlink_metadata(&pb).map_err(|e| format!("无法读取音频文件元数据: {e}"))?;
    if sm.file_type().is_symlink() {
        return Err("拒绝读取：音频文件为符号链接。".into());
    }
    let root_can = fs::canonicalize(root).map_err(|e| format!("无法解析应用数据根目录: {e}"))?;
    let file_can = fs::canonicalize(&pb).map_err(|e| format!("无法解析音频文件路径: {e}"))?;
    if file_can.strip_prefix(&root_can).is_err() {
        return Err("拒绝读取：音频文件不在应用数据根之下。".into());
    }
    if !file_can.is_file() {
        return Err("音频文件不存在或不是普通文件".into());
    }
    Ok(file_can)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn resolve_audio_path_under_root_rejects_outside_file() {
        let root = std::env::temp_dir().join(format!("rushi-audio-root-{}", Uuid::new_v4()));
        let outside = std::env::temp_dir().join(format!("rushi-audio-out-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        fs::write(&outside, b"not project media").unwrap();

        let err = resolve_audio_path_under_root(&root, outside.to_str().unwrap()).unwrap_err();
        assert!(err.contains("应用数据根"));

        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolve_audio_path_under_root_accepts_file_under_root() {
        let root = std::env::temp_dir().join(format!("rushi-audio-root-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let audio = root.join("a.wav");
        fs::write(&audio, b"wav").unwrap();

        let resolved = resolve_audio_path_under_root(&root, audio.to_str().unwrap()).unwrap();
        assert!(resolved.is_file());
        assert!(resolved
            .strip_prefix(fs::canonicalize(&root).unwrap())
            .is_ok());

        let _ = fs::remove_dir_all(root);
    }
}

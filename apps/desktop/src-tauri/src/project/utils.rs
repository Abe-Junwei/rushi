use super::types::{FileDetail, FileSummary, ProjectDetail, SegmentDto};
use crate::DbState;
use rusqlite::{params, Connection};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

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
    let clean = line.replace(['\n', '\r'], " ");
    let line_bytes = format!("{ts}\t{clean}\n");
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(line_bytes.as_bytes());
    }
}

pub fn open_db(state: &DbState) -> Result<Connection, String> {
    let conn = Connection::open(&state.db_path).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;
    conn.busy_timeout(Duration::from_millis(5000))
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn project_detail_from_conn(
    conn: &Connection,
    project_id: &str,
) -> Result<ProjectDetail, String> {
    let (name, c_ms, u_ms): (String, i64, i64) = conn
        .query_row(
            "SELECT name, created_at_ms, updated_at_ms FROM projects WHERE id = ?1",
            params![project_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
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
    })
}

pub fn file_detail_from_conn(
    conn: &Connection,
    file_id: &str,
) -> Result<FileDetail, String> {
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
            "SELECT idx, start_sec, end_sec, text, confidence, low_confidence, detail \
             FROM segments WHERE file_id = ?1 ORDER BY idx ASC",
        )
        .map_err(|e| e.to_string())?;
    let segs = stmt
        .query_map(params![file_id], |r| {
            let detail: String = r.get(6)?;
            Ok(SegmentDto {
                idx: r.get(0)?,
                start_sec: r.get(1)?,
                end_sec: r.get(2)?,
                text: r.get(3)?,
                confidence: r.get(4)?,
                low_confidence: r.get::<_, i64>(5)? != 0,
                detail: if detail.is_empty() {
                    None
                } else {
                    Some(detail)
                },
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

pub fn remove_project_audio_parent_dir(
    root: &Path,
    audio_storage_path: &str,
) -> Result<(), String> {
    let pb = PathBuf::from(audio_storage_path);
    let Some(parent) = pb.parent() else {
        return Ok(());
    };
    if !parent.exists() {
        return Ok(());
    }
    let sm = fs::symlink_metadata(parent).map_err(|e| format!("无法读取项目目录元数据: {e}"))?;
    if sm.file_type().is_symlink() {
        return Err("拒绝删除：项目目录为符号链接，请先移除链接。".into());
    }
    let root_can = fs::canonicalize(root).map_err(|e| format!("无法解析应用数据根目录: {e}"))?;
    let parent_can = fs::canonicalize(parent).map_err(|e| format!("无法解析项目目录: {e}"))?;
    if parent_can.strip_prefix(&root_can).is_err() {
        return Err("拒绝删除：项目目录不在应用数据根之下。".into());
    }
    fs::remove_dir_all(&parent_can).map_err(|e| format!("删除项目目录失败: {e}"))?;
    Ok(())
}

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
    project_detail_inner(conn, project_id, None)
}

/// Like [`project_detail_from_conn`] but resolves media existence for Hub rows.
pub fn project_detail_with_media(st: &DbState, project_id: &str) -> Result<ProjectDetail, String> {
    let conn = open_db(st)?;
    project_detail_inner(&conn, project_id, Some(st))
}

fn project_detail_inner(
    conn: &Connection,
    project_id: &str,
    st: Option<&DbState>,
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

    let files = list_file_summaries(conn, project_id, st)?;

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

/// Project file list for Hub — segment aggregates + optional media existence check.
pub fn list_file_summaries(
    conn: &Connection,
    project_id: &str,
    st: Option<&DbState>,
) -> Result<Vec<FileSummary>, String> {
    let mut stmt = conn
        .prepare(
            // Effective content segment = not placeholder / whole-track fallback, and has
            // non-empty text (aligns with frontend segmentsHaveNonEmptyText for Hub truth).
            "SELECT f.id, f.name, f.file_type, f.updated_at_ms, f.duration_sec, f.audio_path, \
                    f.import_source_size, \
                    COALESCE(SUM(CASE WHEN COALESCE(s.kind, '') != 'placeholder' \
                      AND COALESCE(s.detail, '') != 'funasr_whole_track_fallback' \
                      AND LENGTH(TRIM(COALESCE(s.text, ''))) > 0 THEN 1 ELSE 0 END), 0), \
                    COALESCE(SUM(CASE WHEN COALESCE(s.kind, '') != 'placeholder' \
                      AND COALESCE(s.detail, '') != 'funasr_whole_track_fallback' \
                      AND LENGTH(TRIM(COALESCE(s.text, ''))) > 0 \
                      AND COALESCE(NULLIF(TRIM(s.text_stage), ''), 'auto_transcribe') = 'first_proof' \
                      THEN 1 ELSE 0 END), 0), \
                    COALESCE(SUM(CASE WHEN COALESCE(s.kind, '') != 'placeholder' \
                      AND COALESCE(s.detail, '') != 'funasr_whole_track_fallback' \
                      AND LENGTH(TRIM(COALESCE(s.text, ''))) > 0 \
                      AND s.text_stage = 'finalized' THEN 1 ELSE 0 END), 0) \
             FROM files f \
             LEFT JOIN segments s ON s.file_id = f.id \
             WHERE f.project_id = ?1 \
             GROUP BY f.id \
             ORDER BY f.created_at_ms ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, Option<f64>>(4)?,
                r.get::<_, Option<String>>(5)?,
                r.get::<_, Option<i64>>(6)?,
                r.get::<_, i64>(7)?,
                r.get::<_, i64>(8)?,
                r.get::<_, i64>(9)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (
            id,
            name,
            file_type,
            updated_at_ms,
            duration_sec,
            audio_path,
            import_source_size,
            segment_count,
            first_proof_count,
            finalized_count,
        ) = row.map_err(|e| e.to_string())?;
        let draft_count = (segment_count - first_proof_count - finalized_count).max(0);
        let media_missing = compute_media_missing(st, &file_type, audio_path.as_deref());
        let display_size =
            resolve_display_media_bytes(st, &id, import_source_size, audio_path.as_deref());
        out.push(FileSummary {
            id,
            name,
            file_type,
            updated_at_ms,
            duration_sec: duration_sec.filter(|d| d.is_finite() && *d > 0.0),
            segment_count,
            draft_count,
            first_proof_count,
            finalized_count,
            import_source_size: display_size,
            media_missing,
        });
    }
    Ok(out)
}

fn compute_media_missing(st: Option<&DbState>, file_type: &str, audio_path: Option<&str>) -> bool {
    if file_type == "text" {
        return false;
    }
    let Some(raw) = audio_path.map(str::trim).filter(|s| !s.is_empty()) else {
        return true;
    };
    let Some(st) = st else {
        // Without DbState (unit paths), only flag empty path; don't false-positive.
        return false;
    };
    crate::media_base_dir::resolve_audio_path(st, raw).is_err()
}

/// Hub size: prefer stored import provenance; else on-disk media length.
/// Best-effort backfill of `import_source_size` when provenance was never written.
fn resolve_display_media_bytes(
    st: Option<&DbState>,
    file_id: &str,
    import_source_size: Option<i64>,
    audio_path: Option<&str>,
) -> Option<i64> {
    if let Some(n) = import_source_size.filter(|n| *n > 0) {
        return Some(n);
    }
    let st = st?;
    let raw = audio_path.map(str::trim).filter(|s| !s.is_empty())?;
    let path = crate::media_base_dir::resolve_audio_path(st, raw).ok()?;
    let len = fs::metadata(&path).ok()?.len() as i64;
    if len <= 0 {
        return None;
    }
    // Persist so Hub stays consistent even when resolve is skipped later.
    if let Ok(conn) = open_db(st) {
        let _ = conn.execute(
            "UPDATE files SET import_source_size = ?1 \
             WHERE id = ?2 AND (import_source_size IS NULL OR import_source_size <= 0)",
            params![len, file_id],
        );
    }
    Some(len)
}

/// Persist probed duration for Hub list (idempotent upsert of positive finite secs).
pub fn update_file_duration_sec(
    conn: &Connection,
    file_id: &str,
    duration_sec: f64,
) -> Result<(), String> {
    if !duration_sec.is_finite() || duration_sec <= 0.0 {
        return Ok(());
    }
    conn.execute(
        "UPDATE files SET duration_sec = ?1 WHERE id = ?2",
        params![duration_sec, file_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Probe audio and cache duration on `files` (best-effort; never fails the caller).
pub fn persist_probed_file_duration(st: &DbState, file_id: &str, audio_path: &Path) {
    let Some(dur) = super::transcribe_timeout::probe_audio_duration_sec(audio_path) else {
        return;
    };
    let Ok(conn) = open_db(st) else {
        return;
    };
    let _ = update_file_duration_sec(&conn, file_id, dur);
}

pub fn file_detail_from_conn(conn: &Connection, file_id: &str) -> Result<FileDetail, String> {
    let (project_id, name, file_type, audio_path, duration_sec, c_ms, u_ms): (
        String,
        String,
        String,
        Option<String>,
        Option<f64>,
        i64,
        i64,
    ) = conn
        .query_row(
            "SELECT project_id, name, file_type, audio_path, duration_sec, created_at_ms, updated_at_ms \
             FROM files WHERE id = ?1",
            params![file_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?)),
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
        duration_sec: duration_sec.filter(|d| d.is_finite() && *d > 0.0),
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
/// `audio_storage_path` 可为相对媒体基准或 legacy 绝对路径（见 `media_base_dir::resolve_audio_path`）。
pub fn remove_audio_file(st: &DbState, audio_storage_path: &str) -> Result<(), String> {
    let file_can = match crate::media_base_dir::resolve_audio_path(st, audio_storage_path) {
        Ok(p) => p,
        Err(_) => {
            // Already gone / unreadable — treat as success for cleanup.
            return Ok(());
        }
    };
    if !file_can.exists() {
        return Ok(());
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

/// Absolute canonical path for persisting in `files.audio_path` (legacy helper).
/// Prefer [`crate::media_base_dir::persist_audio_storage_path`] for new writes.
pub fn canonicalize_audio_storage_path(path: &Path) -> Result<String, String> {
    let canonical = fs::canonicalize(path)
        .map_err(|e| format!("无法规范化音频路径 ({}): {e}", path.display()))?;
    Ok(canonical.to_string_lossy().to_string())
}

/// Legacy scoped resolve against a single root (unit tests; production uses `media_base_dir::resolve_audio_path`).
#[cfg_attr(not(test), allow(dead_code))]
pub fn resolve_audio_path_under_root(root: &Path, raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("音频路径为空".into());
    }
    let pb = PathBuf::from(trimmed);
    let sm = fs::symlink_metadata(&pb).map_err(|e| format!("无法读取音频文件元数据: {e}"))?;
    let was_symlink = sm.file_type().is_symlink();
    let root_can = fs::canonicalize(root).map_err(|e| format!("无法解析应用数据根目录: {e}"))?;
    let file_can = fs::canonicalize(&pb).map_err(|e| format!("无法解析音频文件路径: {e}"))?;
    if file_can.strip_prefix(&root_can).is_err() {
        if was_symlink {
            return Err("拒绝读取：符号链接目标不在应用数据根之下。".into());
        }
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

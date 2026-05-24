use super::correction::{load_file_segment_texts, update_correction_memory_from_save};
use super::types::{FileDetail, FileSummary, ProjectDetail, ProjectSummary, SegmentDto};
use super::utils::{
    append_desktop_log_line, file_detail_from_conn, now_ms, open_db, project_detail_from_conn,
    remove_project_audio_parent_dir,
};
use crate::DbState;
use rusqlite::params;
use std::fs;
use std::ops::Deref;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

pub fn file_save_segments_inner(
    state: &DbState,
    file_id: &str,
    segments: &[SegmentDto],
) -> Result<(), String> {
    let mut conn = open_db(state)?;
    let old_text_by_idx = load_file_segment_texts(&conn, file_id)?;
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Get project_id for edit_log
    let project_id: String = tx
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    tx.execute(
        "DELETE FROM segments WHERE file_id = ?1",
        params![file_id],
    )
    .map_err(|e| e.to_string())?;
    for s in segments {
        let low = if s.low_confidence { 1i64 } else { 0i64 };
        let detail = s.detail.as_deref().unwrap_or("");
        tx.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                file_id,
                s.idx,
                s.start_sec,
                s.end_sec,
                s.text.as_str(),
                s.confidence,
                low,
                detail,
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute(
        "UPDATE files SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, file_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    let detail = serde_json::json!({
        "op": "save_segments",
        "file_id": file_id,
        "count": segments.len(),
        "at_ms": t,
    })
    .to_string();
    tx.execute(
        "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, t, "save_segments", detail.as_str()],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    if let Err(e) = update_correction_memory_from_save(&conn, &old_text_by_idx, segments) {
        append_desktop_log_line(state, &format!("WARN correction_memory_update_failed {e}"));
    }
    Ok(())
}

#[tauri::command]
pub fn file_save_segments(
    state: State<DbState>,
    file_id: String,
    segments: Vec<SegmentDto>,
) -> Result<(), String> {
    file_save_segments_inner(state.deref(), &file_id, &segments)
}

#[tauri::command]
pub fn pick_audio_path() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter(
            "音视频",
            &[
                "wav", "mp3", "m4a", "aac", "flac", "ogg", "mp4", "webm", "mov", "caf", "aiff",
            ],
        )
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_text_path() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("文本文件", &["txt", "srt"])
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn project_create_from_audio(
    state: State<DbState>,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("dat")
        .to_ascii_lowercase();
    let project_id = Uuid::new_v4().to_string();
    let dest_dir = st.root.join("projects").join(&project_id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest_audio = dest_dir.join(format!("audio.{ext}"));
    fs::copy(&src, &dest_audio).map_err(|e| {
        let _ = fs::remove_dir_all(&dest_dir);
        e.to_string()
    })?;
    let dest_str = dest_audio.to_string_lossy().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let mut conn = open_db(st)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if let Err(e) = tx.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, &name, t, t],
    ) {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(e.to_string());
    }
    if let Err(e) = tx.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&file_id, &project_id, &name, "paired", &dest_str, t, t],
    ) {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(e.to_string());
    }
    tx.commit().map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn create_empty_project(state: State<DbState>, name: String) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let project_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, &name, t, t],
    )
    .map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

/// Parse SRT timestamp "HH:MM:SS,mmm" to seconds.
fn parse_srt_time(s: &str) -> Option<f64> {
    let s = s.trim();
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let sec_ms = parts[2];
    let sec_parts: Vec<&str> = sec_ms.split(',').collect();
    if sec_parts.len() != 2 {
        return None;
    }
    let sec: f64 = sec_parts[0].parse().ok()?;
    let ms: f64 = sec_parts[1].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + sec + ms / 1000.0)
}

fn parse_srt(content: &str) -> Result<Vec<SegmentDto>, String> {
    let mut segments = Vec::new();
    let blocks: Vec<&str> = content.split("\n\n").collect();
    for block in blocks {
        let lines: Vec<&str> = block.lines().collect();
        if lines.len() < 3 {
            continue;
        }
        // lines[0] = index number (skip)
        let time_line = lines[1];
        let time_parts: Vec<&str> = time_line.split(" --> ").collect();
        if time_parts.len() != 2 {
            continue;
        }
        let start_sec = parse_srt_time(time_parts[0]).ok_or("SRT 时间戳格式错误")?;
        let end_sec = parse_srt_time(time_parts[1]).ok_or("SRT 时间戳格式错误")?;
        let text = lines[2..].join("\n");
        segments.push(SegmentDto {
            idx: segments.len() as i32,
            start_sec,
            end_sec,
            text,
            confidence: None,
            low_confidence: false,
            detail: None,
        });
    }
    Ok(segments)
}

/// Estimate timestamps for plain text paragraphs.
/// Chinese chars at ~250 chars/minute = ~4.167 chars/second.
const CHARS_PER_SEC: f64 = 250.0 / 60.0;

fn parse_txt(content: &str) -> Vec<SegmentDto> {
    let mut segments = Vec::new();
    let paragraphs: Vec<&str> = content.split("\n\n").collect();
    let mut current_sec = 0.0;
    for para in paragraphs {
        let text = para.trim().replace('\n', " ");
        if text.is_empty() {
            continue;
        }
        let char_count = text.chars().count() as f64;
        let duration = char_count / CHARS_PER_SEC;
        let start_sec = current_sec;
        let end_sec = current_sec + duration.max(1.0); // min 1 second per paragraph
        segments.push(SegmentDto {
            idx: segments.len() as i32,
            start_sec,
            end_sec,
            text,
            confidence: None,
            low_confidence: false,
            detail: None,
        });
        current_sec = end_sec;
    }
    segments
}

#[tauri::command]
pub fn create_project_from_text(
    state: State<DbState>,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_ascii_lowercase();

    let content = fs::read_to_string(&src).map_err(|e| format!("读取文件失败: {e}"))?;

    let segments = if ext == "srt" {
        parse_srt(&content)?
    } else {
        parse_txt(&content)
    };

    let project_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();

    let mut conn = open_db(st)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, &name, t, t],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, &name, "text", t, t],
    )
    .map_err(|e| e.to_string())?;

    for s in &segments {
        tx.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &file_id,
                s.idx,
                s.start_sec,
                s.end_sec,
                s.text.as_str(),
                s.confidence,
                if s.low_confidence { 1i64 } else { 0i64 },
                s.detail.as_deref().unwrap_or(""),
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn create_empty_text_file(
    state: State<DbState>,
    project_id: String,
    name: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, &name, "text", t, t],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn import_audio_to_project(
    state: State<DbState>,
    project_id: String,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("dat")
        .to_ascii_lowercase();
    let dest_dir = st.root.join("projects").join(&project_id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest_audio = dest_dir.join(format!("audio.{ext}"));
    fs::copy(&src, &dest_audio).map_err(|e| e.to_string())?;
    let dest_str = dest_audio.to_string_lossy().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&file_id, &project_id, &name, "paired", &dest_str, t, t],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn import_text_to_project(
    state: State<DbState>,
    project_id: String,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_ascii_lowercase();
    let content = fs::read_to_string(&src).map_err(|e| format!("读取文件失败: {e}"))?;
    let segments = if ext == "srt" {
        parse_srt(&content)?
    } else {
        parse_txt(&content)
    };
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let mut conn = open_db(st)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, &name, "text", t, t],
    )
    .map_err(|e| e.to_string())?;
    for s in &segments {
        tx.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &file_id,
                s.idx,
                s.start_sec,
                s.end_sec,
                s.text.as_str(),
                s.confidence,
                if s.low_confidence { 1i64 } else { 0i64 },
                s.detail.as_deref().unwrap_or(""),
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn project_list(state: State<DbState>) -> Result<Vec<ProjectSummary>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.updated_at_ms, COUNT(f.id) as file_count \
             FROM projects p LEFT JOIN files f ON p.id = f.project_id \
             GROUP BY p.id \
             ORDER BY p.updated_at_ms DESC"
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ProjectSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                updated_at_ms: r.get(2)?,
                file_count: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn project_load(state: State<DbState>, project_id: String) -> Result<ProjectDetail, String> {
    let conn = open_db(state.deref())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn project_delete(state: State<DbState>, project_id: String) -> Result<(), String> {
    let st: &DbState = state.deref();
    let conn = open_db(st)?;
    // Collect all audio paths for cleanup before database deletion
    let mut stmt = conn
        .prepare("SELECT audio_path FROM files WHERE project_id = ?1 AND audio_path IS NOT NULL")
        .map_err(|e| e.to_string())?;
    let audio_paths: Vec<String> = stmt
        .query_map(params![&project_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    // Delete audio files first; if any fails, keep DB records for retry
    for p in &audio_paths {
        if let Err(e) = remove_project_audio_parent_dir(&st.root, p) {
            append_desktop_log_line(
                st,
                &format!("ERROR project_delete_cleanup project_id={project_id} {e}"),
            );
            return Err(format!(
                "清理项目文件失败：{e}。数据库记录保留，请重试或手动删除。"
            ));
        }
    }
    conn.execute("DELETE FROM projects WHERE id = ?1", params![&project_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========== File-level commands ==========

#[tauri::command]
pub fn list_files(state: State<DbState>, project_id: String) -> Result<Vec<FileSummary>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, file_type, updated_at_ms FROM files WHERE project_id = ?1 ORDER BY created_at_ms ASC"
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |r| {
            Ok(FileSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                file_type: r.get(2)?,
                updated_at_ms: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn load_file(state: State<DbState>, file_id: String) -> Result<FileDetail, String> {
    let conn = open_db(state.deref())?;
    file_detail_from_conn(&conn, &file_id)
}

#[tauri::command]
pub fn rename_file(
    state: State<DbState>,
    file_id: String,
    name: String,
) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    let t = now_ms();
    conn.execute(
        "UPDATE files SET name = ?1, updated_at_ms = ?2 WHERE id = ?3",
        params![&name, t, &file_id],
    )
    .map_err(|e| e.to_string())?;
    // Also update project updated_at_ms
    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![&file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_file(state: State<DbState>, file_id: String) -> Result<(), String> {
    let st: &DbState = state.deref();
    let conn = open_db(st)?;

    // Get audio_path for cleanup
    let audio_path: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT audio_path FROM files WHERE id = ?1",
        params![&file_id],
        |r| r.get(0),
    );

    // Get project_id for updating timestamp after deletion
    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![&file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Delete file (cascades to segments via FK)
    conn.execute("DELETE FROM files WHERE id = ?1", params![&file_id])
        .map_err(|e| e.to_string())?;

    // Update project timestamp
    let t = now_ms();
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;

    // Cleanup audio if exists
    if let Ok(p) = audio_path {
        let _ = remove_project_audio_parent_dir(&st.root, &p);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi_project_cmd_{label}_{unique}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn test_state(label: &str) -> DbState {
        let root = test_root(label);
        let db_path = root.join("rushi.sqlite3");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        db::migrate(&conn).unwrap();
        drop(conn);
        DbState { root, db_path }
    }

    // ========== parse_txt / parse_srt ==========

    #[test]
    fn parse_txt_empty_returns_empty() {
        let segs = parse_txt("");
        assert!(segs.is_empty());
    }

    #[test]
    fn parse_txt_single_paragraph() {
        let segs = parse_txt("你好世界");
        assert_eq!(segs.len(), 1);
        assert_eq!(segs[0].text, "你好世界");
        assert_eq!(segs[0].idx, 0);
        assert_eq!(segs[0].start_sec, 0.0);
        assert!(segs[0].end_sec > 0.0);
    }

    #[test]
    fn parse_txt_multiple_paragraphs() {
        let segs = parse_txt("第一段\n\n第二段");
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0].text, "第一段");
        assert_eq!(segs[1].text, "第二段");
        assert_eq!(segs[1].start_sec, segs[0].end_sec);
    }

    #[test]
    fn parse_txt_newline_becomes_space() {
        let segs = parse_txt("第一行\n第二行");
        assert_eq!(segs.len(), 1);
        assert_eq!(segs[0].text, "第一行 第二行");
    }

    #[test]
    fn parse_srt_basic() {
        let srt = "1\n00:00:01,000 --> 00:00:03,500\nHello world\n\n2\n00:00:04,000 --> 00:00:06,000\n第二句";
        let segs = parse_srt(srt).unwrap();
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0].idx, 0);
        assert_eq!(segs[0].start_sec, 1.0);
        assert_eq!(segs[0].end_sec, 3.5);
        assert_eq!(segs[0].text, "Hello world");
        assert_eq!(segs[1].idx, 1);
        assert_eq!(segs[1].start_sec, 4.0);
        assert_eq!(segs[1].end_sec, 6.0);
        assert_eq!(segs[1].text, "第二句");
    }

    #[test]
    fn parse_srt_empty_returns_empty() {
        let segs = parse_srt("").unwrap();
        assert!(segs.is_empty());
    }

    #[test]
    fn parse_srt_multiline_text() {
        let srt = "1\n00:00:00,000 --> 00:00:02,000\n第一行\n第二行";
        let segs = parse_srt(srt).unwrap();
        assert_eq!(segs.len(), 1);
        assert_eq!(segs[0].text, "第一行\n第二行");
    }

    // ========== Database operations via open_db + SQL ==========

    #[test]
    fn create_empty_project_creates_project_with_no_files() {
        let st = test_state("empty_project");
        let project_id = Uuid::new_v4().to_string();
        let t = now_ms();
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Empty Project", t, t],
        ).unwrap();

        let detail = project_detail_from_conn(&conn, &project_id).unwrap();
        assert_eq!(detail.id, project_id);
        assert_eq!(detail.name, "Empty Project");
        assert!(detail.files.is_empty());
    }

    #[test]
    fn create_project_with_file_then_list_and_load() {
        let st = test_state("with_file");
        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let t = now_ms();
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Project", t, t],
        ).unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&file_id, &project_id, "audio.wav", "paired", "/tmp/audio.wav", t, t],
        ).unwrap();

        // list_files via SQL
        let mut stmt = conn.prepare("SELECT id, name, file_type, updated_at_ms FROM files WHERE project_id = ?1").unwrap();
        let rows: Vec<FileSummary> = stmt.query_map(params![&project_id], |r| {
            Ok(FileSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                file_type: r.get(2)?,
                updated_at_ms: r.get(3)?,
            })
        }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "audio.wav");
        assert_eq!(rows[0].file_type, "paired");

        // load_file via file_detail_from_conn
        let detail = file_detail_from_conn(&conn, &file_id).unwrap();
        assert_eq!(detail.id, file_id);
        assert_eq!(detail.name, "audio.wav");
        assert_eq!(detail.audio_path, Some("/tmp/audio.wav".to_string()));
    }

    #[test]
    fn rename_file_updates_name_and_project_timestamp() {
        let st = test_state("rename");
        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let t = now_ms();
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Project", t, t],
        ).unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_id, &project_id, "old.txt", "text", t, t],
        ).unwrap();

        let new_t = t + 1000;
        conn.execute(
            "UPDATE files SET name = ?1, updated_at_ms = ?2 WHERE id = ?3",
            params!["new.txt", new_t, &file_id],
        ).unwrap();
        conn.execute(
            "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
            params![new_t, &project_id],
        ).unwrap();

        let name: String = conn.query_row(
            "SELECT name FROM files WHERE id = ?1",
            params![&file_id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(name, "new.txt");
    }

    #[test]
    fn delete_file_cascades_to_segments() {
        let st = test_state("delete");
        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let t = now_ms();
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Project", t, t],
        ).unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_id, &project_id, "file.txt", "text", t, t],
        ).unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![&file_id, 0, 0.0, 1.0, "seg1"],
        ).unwrap();

        conn.execute("DELETE FROM files WHERE id = ?1", params![&file_id]).unwrap();

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM segments WHERE file_id = ?1",
            params![&file_id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(count, 0);
    }
}

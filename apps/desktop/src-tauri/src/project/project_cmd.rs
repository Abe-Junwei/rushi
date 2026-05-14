use super::correction::{load_project_segment_texts, update_correction_memory_from_save};
use super::types::{ProjectDetail, ProjectSummary, SegmentDto};
use super::utils::{
    append_desktop_log_line, now_ms, open_db, project_detail_from_conn,
    remove_project_audio_parent_dir,
};
use crate::DbState;
use rusqlite::params;
use std::fs;
use std::ops::Deref;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

pub fn project_save_segments_inner(
    state: &DbState,
    project_id: &str,
    segments: &[SegmentDto],
) -> Result<(), String> {
    let mut conn = open_db(state)?;
    let old_text_by_idx = load_project_segment_texts(&conn, project_id)?;
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM segments WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;
    for s in segments {
        let low = if s.low_confidence { 1i64 } else { 0i64 };
        let detail = s.detail.as_deref().unwrap_or("");
        tx.execute(
            "INSERT INTO segments (project_id, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                project_id,
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
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, project_id],
    )
    .map_err(|e| e.to_string())?;
    let detail = serde_json::json!({
        "op": "save_segments",
        "count": segments.len(),
        "at_ms": t,
    })
    .to_string();
    tx.execute(
        "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, t, "save_segments", detail.as_str()],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    if let Err(e) = update_correction_memory_from_save(&conn, &old_text_by_idx, segments) {
        append_desktop_log_line(state, &format!("WARN correction_memory_update_failed {e}"));
    }
    Ok(())
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
pub fn project_create(
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
    let id = Uuid::new_v4().to_string();
    let dest_dir = st.root.join("projects").join(&id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest_audio = dest_dir.join(format!("audio.{ext}"));
    fs::copy(&src, &dest_audio).map_err(|e| {
        let _ = fs::remove_dir_all(&dest_dir);
        e.to_string()
    })?;
    let dest_str = dest_audio.to_string_lossy().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    if let Err(e) = conn.execute(
        "INSERT INTO projects (id, name, audio_storage_path, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&id, &name, &dest_str, t, t],
    ) {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(e.to_string());
    }
    project_detail_from_conn(&conn, &id)
}

#[tauri::command]
pub fn project_list(state: State<DbState>) -> Result<Vec<ProjectSummary>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare("SELECT id, name, updated_at_ms FROM projects ORDER BY updated_at_ms DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ProjectSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                updated_at_ms: r.get(2)?,
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
    let audio_path: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT audio_storage_path FROM projects WHERE id = ?1",
        params![&project_id],
        |r| r.get(0),
    );
    let audio_path = match audio_path {
        Ok(p) => Some(p),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(e.to_string()),
    };
    // 先删文件再删数据库：文件删除失败时记录保留，用户可重试
    if let Some(ref p) = audio_path {
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

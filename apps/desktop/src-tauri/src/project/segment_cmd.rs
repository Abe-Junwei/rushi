use super::correction::{load_file_segment_texts, update_correction_memory_from_save};
use super::types::SegmentDto;
use super::utils::{append_desktop_log_line, now_ms, open_db};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use tauri::State;

pub fn file_save_segments_inner(
    state: &DbState,
    file_id: &str,
    segments: &[SegmentDto],
) -> Result<(), String> {
    let mut conn = open_db(state)?;
    let old_text_by_idx = load_file_segment_texts(&conn, file_id)?;
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let project_id: String = tx
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM segments WHERE file_id = ?1", params![file_id])
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

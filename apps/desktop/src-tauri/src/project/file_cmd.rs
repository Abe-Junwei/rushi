use super::types::{FileDetail, FileSummary};
use super::project_storage::cleanup_deleted_file_storage;
use super::utils::{file_detail_from_conn, now_ms, open_db};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use tauri::State;

#[tauri::command]
pub fn list_files(state: State<DbState>, project_id: String) -> Result<Vec<FileSummary>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, file_type, updated_at_ms FROM files WHERE project_id = ?1 ORDER BY created_at_ms ASC",
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
pub fn rename_file(state: State<DbState>, file_id: String, name: String) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    let t = now_ms();
    conn.execute(
        "UPDATE files SET name = ?1, updated_at_ms = ?2 WHERE id = ?3",
        params![&name, t, &file_id],
    )
    .map_err(|e| e.to_string())?;
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

    let audio_path: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT audio_path FROM files WHERE id = ?1",
        params![&file_id],
        |r| r.get(0),
    );

    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![&file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM files WHERE id = ?1", params![&file_id])
        .map_err(|e| e.to_string())?;

    let t = now_ms();
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;

    if let Ok(p) = audio_path {
        cleanup_deleted_file_storage(st, &project_id, &file_id, Some(p.as_str()));
    } else {
        cleanup_deleted_file_storage(st, &project_id, &file_id, None);
    }

    Ok(())
}

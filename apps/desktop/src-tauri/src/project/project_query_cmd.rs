use super::types::{EditLogEntryDto, ProjectDetail, ProjectSummary};
use super::utils::{open_db, project_detail_from_conn};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use tauri::State;

#[tauri::command]
pub fn project_list(state: State<DbState>) -> Result<Vec<ProjectSummary>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.updated_at_ms, COUNT(f.id) as file_count \
             FROM projects p LEFT JOIN files f ON p.id = f.project_id \
             GROUP BY p.id \
             ORDER BY p.updated_at_ms DESC",
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
pub fn project_list_edit_log(
    state: State<DbState>,
    project_id: String,
    limit: Option<i64>,
) -> Result<Vec<EditLogEntryDto>, String> {
    let conn = open_db(state.deref())?;
    let capped_limit = limit.unwrap_or(40).clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT e.id, e.project_id, e.at_ms, e.kind, e.detail, \
             CASE WHEN s.edit_log_id IS NOT NULL THEN 1 ELSE 0 END AS has_snapshot \
             FROM edit_log e \
             LEFT JOIN edit_log_snapshots s ON s.edit_log_id = e.id \
             WHERE e.project_id = ?1 ORDER BY e.id DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id, capped_limit], |r| {
            Ok(EditLogEntryDto {
                id: r.get(0)?,
                project_id: r.get(1)?,
                at_ms: r.get(2)?,
                kind: r.get(3)?,
                detail: r.get(4)?,
                has_snapshot: r.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

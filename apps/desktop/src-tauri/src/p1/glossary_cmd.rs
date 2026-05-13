use super::types::GlossaryTermDto;
use super::utils::{is_sqlite_unique_violation, now_ms, open_db};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use tauri::State;

#[tauri::command]
pub fn p2_glossary_list(state: State<DbState>) -> Result<Vec<GlossaryTermDto>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, term, created_at_ms FROM glossary_terms ORDER BY term COLLATE NOCASE ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(GlossaryTermDto {
                id: r.get(0)?,
                term: r.get(1)?,
                created_at_ms: r.get(2)?,
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
pub fn p2_glossary_add(state: State<DbState>, term: String) -> Result<GlossaryTermDto, String> {
    let t = term.trim().to_string();
    if t.is_empty() {
        return Err("术语不能为空".to_string());
    }
    let conn = open_db(state.deref())?;
    let now = now_ms();
    let res = conn.execute(
        "INSERT INTO glossary_terms (term, created_at_ms) VALUES (?1, ?2)",
        params![t.as_str(), now],
    );
    if let Err(e) = res {
        if is_sqlite_unique_violation(&e) {
            return Err("该术语已存在（忽略大小写）".to_string());
        }
        return Err(e.to_string());
    }
    let id = conn.last_insert_rowid();
    Ok(GlossaryTermDto {
        id,
        term: t,
        created_at_ms: now,
    })
}

#[tauri::command]
pub fn p2_glossary_delete(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    let n = conn
        .execute("DELETE FROM glossary_terms WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("未找到该术语".to_string());
    }
    Ok(())
}

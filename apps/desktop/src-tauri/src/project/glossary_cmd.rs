use super::glossary_hotwords::build_glossary_hotwords;
use super::glossary_hotwords::GlossaryHotwordsPreview;
use super::glossary_import::rows_from_glossary_file;
use super::glossary_insert::GlossaryInsertRow;
use super::hotword_guard::reject_glossary_correction_before_texts;
use super::types::GlossaryTermDto;
use super::utils::{is_sqlite_unique_violation, now_ms, open_db};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryImportResult {
    pub parsed: usize,
    pub added: usize,
    pub skipped_dup: usize,
    pub skipped_wrong_form: usize,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryBatchResult {
    pub requested: usize,
    pub affected: usize,
}

fn row_to_glossary_term(r: &rusqlite::Row<'_>) -> rusqlite::Result<GlossaryTermDto> {
    let created_at_ms: i64 = r.get(3)?;
    let updated_at_ms: Option<i64> = r.get(6)?;
    let hotword_enabled: i64 = r.get(7)?;
    Ok(GlossaryTermDto {
        id: r.get(0)?,
        term: r.get(1)?,
        aliases: r.get(2)?,
        domain: r.get(4)?,
        note: r.get(5)?,
        created_at_ms,
        updated_at_ms: updated_at_ms.unwrap_or(created_at_ms),
        hotword_enabled: hotword_enabled != 0,
    })
}

const GLOSSARY_SELECT: &str =
    "SELECT id, term, aliases, created_at_ms, domain, note, updated_at_ms, hotword_enabled FROM glossary_terms";

fn insert_glossary_rows(
    conn: &mut rusqlite::Connection,
    rows: Vec<GlossaryInsertRow>,
) -> Result<GlossaryImportResult, String> {
    let parsed = rows.len();
    let mut added = 0usize;
    let mut skipped_dup = 0usize;
    let mut skipped_wrong_form = 0usize;
    let now = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for row in rows {
        let t = row.term.trim();
        if t.is_empty() {
            continue;
        }
        if reject_glossary_correction_before_texts(&tx, t, row.aliases.trim()).is_err() {
            skipped_wrong_form += 1;
            continue;
        }
        let res = tx.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![
                t,
                row.aliases.trim(),
                row.domain.trim(),
                row.note.trim(),
                i64::from(row.hotword_enabled),
                now
            ],
        );
        match res {
            Ok(_) => added += 1,
            Err(e) if is_sqlite_unique_violation(&e) => skipped_dup += 1,
            Err(e) => return Err(e.to_string()),
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(GlossaryImportResult {
        parsed,
        added,
        skipped_dup,
        skipped_wrong_form,
    })
}

fn execute_ids_in_chunks(
    conn: &rusqlite::Connection,
    sql_prefix: &str,
    sql_suffix: &str,
    extra_params: &[(&str, i64)],
    ids: &[i64],
) -> Result<usize, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    const CHUNK: usize = 500;
    let mut affected = 0usize;
    for chunk in ids.chunks(CHUNK) {
        let placeholders = (0..chunk.len()).map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("{sql_prefix} ({placeholders}) {sql_suffix}");
        let mut values: Vec<rusqlite::types::Value> = extra_params
            .iter()
            .map(|(_, v)| rusqlite::types::Value::Integer(*v))
            .collect();
        values.extend(chunk.iter().map(|id| rusqlite::types::Value::Integer(*id)));
        let param_refs: Vec<&dyn rusqlite::ToSql> =
            values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        affected += conn
            .execute(&sql, param_refs.as_slice())
            .map_err(|e| e.to_string())?;
    }
    Ok(affected)
}

#[tauri::command]
pub fn glossary_list(
    state: State<DbState>,
    search: Option<String>,
) -> Result<Vec<GlossaryTermDto>, String> {
    let conn = open_db(state.deref())?;
    let sql = if search
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_some()
    {
        format!(
            "{GLOSSARY_SELECT} WHERE term LIKE ?1 OR aliases LIKE ?1 ORDER BY term COLLATE NOCASE ASC"
        )
    } else {
        format!("{GLOSSARY_SELECT} ORDER BY term COLLATE NOCASE ASC")
    };
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = if let Some(s) = search.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        stmt.query_map([format!("%{s}%")], row_to_glossary_term)
            .map_err(|e| e.to_string())?
    } else {
        stmt.query_map([], row_to_glossary_term)
            .map_err(|e| e.to_string())?
    };
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn glossary_add(
    state: State<DbState>,
    term: String,
    aliases: Option<String>,
    domain: Option<String>,
    note: Option<String>,
    hotword_enabled: Option<bool>,
) -> Result<GlossaryTermDto, String> {
    let t = term.trim().to_string();
    if t.is_empty() {
        return Err("术语不能为空".to_string());
    }
    let aliases = aliases.unwrap_or_default().trim().to_string();
    let domain = domain.unwrap_or_default().trim().to_string();
    let note = note.unwrap_or_default().trim().to_string();
    let hotword_enabled = hotword_enabled.unwrap_or(true);
    let conn = open_db(state.deref())?;
    reject_glossary_correction_before_texts(&conn, &t, &aliases)?;
    let now = now_ms();
    let res = conn.execute(
        "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![t.as_str(), aliases, domain, note, i64::from(hotword_enabled), now],
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
        aliases,
        domain,
        note,
        created_at_ms: now,
        updated_at_ms: now,
        hotword_enabled,
    })
}

#[tauri::command]
pub fn glossary_add_batch(
    state: State<DbState>,
    terms: Vec<String>,
    hotword_enabled: Option<bool>,
) -> Result<GlossaryImportResult, String> {
    let enabled = hotword_enabled.unwrap_or(true);
    let rows = terms
        .into_iter()
        .map(|t| {
            let mut row = GlossaryInsertRow::term_only(t);
            row.hotword_enabled = enabled;
            row
        })
        .collect();
    let mut conn = open_db(state.deref())?;
    insert_glossary_rows(&mut conn, rows)
}

#[tauri::command]
pub fn glossary_update(
    state: State<DbState>,
    id: i64,
    term: String,
    aliases: Option<String>,
    domain: Option<String>,
    note: Option<String>,
    hotword_enabled: Option<bool>,
) -> Result<GlossaryTermDto, String> {
    let t = term.trim().to_string();
    if t.is_empty() {
        return Err("术语不能为空".to_string());
    }
    let aliases = aliases.unwrap_or_default().trim().to_string();
    let domain = domain.unwrap_or_default().trim().to_string();
    let note = note.unwrap_or_default().trim().to_string();
    let conn = open_db(state.deref())?;
    reject_glossary_correction_before_texts(&conn, &t, &aliases)?;
    let now = now_ms();
    let hotword_enabled = if let Some(v) = hotword_enabled {
        v
    } else {
        conn.query_row(
            "SELECT hotword_enabled FROM glossary_terms WHERE id = ?1",
            params![id],
            |r| r.get::<_, i64>(0),
        )
        .map(|v| v != 0)
        .map_err(|e| e.to_string())?
    };
    let n = conn
        .execute(
            "UPDATE glossary_terms SET term = ?1, aliases = ?2, domain = ?3, note = ?4, hotword_enabled = ?5, updated_at_ms = ?6 WHERE id = ?7",
            params![t, aliases, domain, note, i64::from(hotword_enabled), now, id],
        )
        .map_err(|e| {
            if is_sqlite_unique_violation(&e) {
                "该术语已存在（忽略大小写）".to_string()
            } else {
                e.to_string()
            }
        })?;
    if n == 0 {
        return Err("未找到该术语".to_string());
    }
    Ok(GlossaryTermDto {
        id,
        term: t,
        aliases,
        domain,
        note,
        created_at_ms: conn
            .query_row(
                "SELECT created_at_ms FROM glossary_terms WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?,
        updated_at_ms: now,
        hotword_enabled,
    })
}

#[tauri::command]
pub fn glossary_delete_batch(
    state: State<DbState>,
    ids: Vec<i64>,
) -> Result<GlossaryBatchResult, String> {
    let requested = ids.len();
    if requested == 0 {
        return Ok(GlossaryBatchResult {
            requested: 0,
            affected: 0,
        });
    }
    let conn = open_db(state.deref())?;
    let affected = execute_ids_in_chunks(
        &conn,
        "DELETE FROM glossary_terms WHERE id IN",
        "",
        &[],
        &ids,
    )?;
    Ok(GlossaryBatchResult {
        requested,
        affected,
    })
}

#[tauri::command]
pub fn glossary_set_hotword_batch(
    state: State<DbState>,
    ids: Vec<i64>,
    enabled: bool,
) -> Result<GlossaryBatchResult, String> {
    let requested = ids.len();
    if requested == 0 {
        return Ok(GlossaryBatchResult {
            requested: 0,
            affected: 0,
        });
    }
    let conn = open_db(state.deref())?;
    let now = now_ms();
    let flag = i64::from(enabled);
    let affected = execute_ids_in_chunks(
        &conn,
        "UPDATE glossary_terms SET hotword_enabled = ?1, updated_at_ms = ?2 WHERE id IN",
        "",
        &[("", flag), ("", now)],
        &ids,
    )?;
    Ok(GlossaryBatchResult {
        requested,
        affected,
    })
}

#[tauri::command]
pub fn glossary_hotwords_preview(state: State<DbState>) -> Result<GlossaryHotwordsPreview, String> {
    let conn = open_db(state.deref())?;
    Ok(build_glossary_hotwords(&conn)?.preview)
}

#[tauri::command]
pub fn glossary_import_from_file(
    state: State<DbState>,
) -> Result<Option<GlossaryImportResult>, String> {
    let path = rfd::FileDialog::new()
        .add_filter("表格", &["xlsx", "xls", "xlsm", "csv", "tsv", "txt", "ods"])
        .pick_file();
    let Some(path) = path else {
        return Ok(None);
    };
    let rows = rows_from_glossary_file(&path)?;
    if rows.is_empty() {
        return Err("文件中未识别到有效术语文本单元格".to_string());
    }
    let mut conn = open_db(state.deref())?;
    insert_glossary_rows(&mut conn, rows).map(Some)
}

#[tauri::command]
pub fn glossary_delete(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    let n = conn
        .execute("DELETE FROM glossary_terms WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("未找到该术语".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;
    use rusqlite::Connection;

    fn mem_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn
    }

    #[test]
    fn update_preserves_created_at() {
        let conn = mem_db();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)",
            params!["foo", "bar", "test", "note", 100_i64],
        )
        .unwrap();
        let id = conn.last_insert_rowid();
        let dto =
            glossary_update_inner(&conn, id, "Foo", "baz", "domain2", "note2", false, 200).unwrap();
        assert_eq!(dto.term, "Foo");
        assert!(!dto.hotword_enabled);
        assert_eq!(dto.created_at_ms, 100);
    }

    #[allow(clippy::too_many_arguments)]
    fn glossary_update_inner(
        conn: &Connection,
        id: i64,
        term: &str,
        aliases: &str,
        domain: &str,
        note: &str,
        hotword_enabled: bool,
        now: i64,
    ) -> Result<GlossaryTermDto, String> {
        let n = conn
            .execute(
                "UPDATE glossary_terms SET term = ?1, aliases = ?2, domain = ?3, note = ?4, hotword_enabled = ?5, updated_at_ms = ?6 WHERE id = ?7",
                params![term, aliases, domain, note, i64::from(hotword_enabled), now, id],
            )
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("未找到该术语".to_string());
        }
        Ok(GlossaryTermDto {
            id,
            term: term.to_string(),
            aliases: aliases.to_string(),
            domain: domain.to_string(),
            note: note.to_string(),
            created_at_ms: conn
                .query_row(
                    "SELECT created_at_ms FROM glossary_terms WHERE id = ?1",
                    params![id],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?,
            updated_at_ms: now,
            hotword_enabled,
        })
    }

    #[test]
    fn batch_delete_uses_in_clause() {
        let conn = mem_db();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES ('a', '', '', '', 1, 1, 1)",
            [],
        )
        .unwrap();
        let id1 = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES ('b', '', '', '', 1, 1, 1)",
            [],
        )
        .unwrap();
        let id2 = conn.last_insert_rowid();
        let affected = execute_ids_in_chunks(
            &conn,
            "DELETE FROM glossary_terms WHERE id IN",
            "",
            &[],
            &[id1, id2],
        )
        .unwrap();
        assert_eq!(affected, 2);
    }
}

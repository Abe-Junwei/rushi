//! Copy app SQLite for diagnostic export with transcript / PII columns redacted.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::utils::redact_secrets_for_log;

const REDACTED: &str = "[REDACTED]";

/// Copy `src_db` to a temp file and redact segment text, names, edit logs, snapshots.
pub fn copy_sanitized_diagnostic_db(src_db: &Path) -> Result<PathBuf, String> {
    let tmp = std::env::temp_dir().join(format!(
        "rushi-diagnostic-sanitized-{}.sqlite3",
        uuid::Uuid::new_v4()
    ));
    fs::copy(src_db, &tmp).map_err(|e| format!("copy db for sanitize: {e}"))?;
    let conn = Connection::open(&tmp).map_err(|e| e.to_string())?;
    sanitize_diagnostic_db(&conn)?;
    Ok(tmp)
}

pub fn sanitize_diagnostic_db(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "UPDATE segments SET text = ?1, detail = CASE \
         WHEN detail IS NOT NULL AND trim(detail) != '' THEN ?1 ELSE detail END",
        [REDACTED],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET name = 'project-' || substr(id, 1, 8)",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("UPDATE files SET name = 'file-' || substr(id, 1, 8)", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE edit_log SET detail = ?1 WHERE detail IS NOT NULL AND trim(detail) != ''",
        [REDACTED],
    )
    .map_err(|e| e.to_string())?;
    redact_edit_log_snapshots(conn)?;
    redact_correction_memory(conn)?;
    redact_glossary_terms(conn)?;
    Ok(())
}

fn redact_edit_log_snapshots(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT edit_log_id, segments_json FROM edit_log_snapshots")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    for (id, json) in rows {
        let redacted = redact_segments_json_text_fields(&json);
        conn.execute(
            "UPDATE edit_log_snapshots SET segments_json = ?1 WHERE edit_log_id = ?2",
            rusqlite::params![redacted, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn redact_correction_memory(conn: &Connection) -> Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='correction_memory'",
            [],
            |_| Ok(()),
        )
        .is_ok();
    if !exists {
        return Ok(());
    }
    conn.execute(
        "UPDATE correction_memory SET before_text = ?1, after_text = ?1",
        [REDACTED],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn redact_glossary_terms(conn: &Connection) -> Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='glossary_terms'",
            [],
            |_| Ok(()),
        )
        .is_ok();
    if !exists {
        return Ok(());
    }
    conn.execute(
        "UPDATE glossary_terms SET term = ?1, note = '', aliases = ''",
        [REDACTED],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Best-effort: redact `"text":"..."` and `"detail":"..."` in snapshot / log JSON strings.
pub fn redact_segments_json_text_fields(json: &str) -> String {
    redact_json_string_field(&redact_json_string_field(json, "detail"), "text")
}

pub fn redact_json_string_field(input: &str, field: &str) -> String {
    let key = format!("\"{field}\"");
    let mut out = input.to_string();
    let mut search_from = 0;
    while let Some(rest) = out.get(search_from..) {
        let Some(key_start) = rest.find(&key) else {
            break;
        };
        let key_start = search_from + key_start;
        let Some(colon) = out[key_start..].find(':') else {
            search_from = key_start + key.len();
            continue;
        };
        let value_start = key_start + colon + 1;
        let Some(rest_val) = out.get(value_start..) else {
            break;
        };
        let trimmed = rest_val.trim_start();
        if let Some(stripped) = trimmed.strip_prefix('"') {
            if let Some(end_quote) = stripped.find('"') {
                let replace_end =
                    value_start + (rest_val.len() - trimmed.len()) + 1 + end_quote + 1;
                out.replace_range(value_start..replace_end, &format!(" \"{REDACTED}\""));
            }
        }
        search_from = key_start + key.len();
    }
    out
}

pub fn redact_diagnostic_log_tail(content: &str) -> String {
    redact_segments_json_text_fields(&redact_secrets_for_log(content))
}

pub fn redact_edit_log_detail_cell(detail: &str) -> String {
    if detail.trim().is_empty() {
        return detail.to_string();
    }
    if detail.trim_start().starts_with('{') || detail.trim_start().starts_with('[') {
        return redact_segments_json_text_fields(&redact_secrets_for_log(detail));
    }
    redact_secrets_for_log(detail)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::Connection;

    #[test]
    fn redact_json_text_field_replaces_all_occurrences() {
        let raw = r#"{"text":"hello","nested":{"text":"world"}}"#;
        let out = redact_segments_json_text_fields(raw);
        assert!(!out.contains("hello"));
        assert!(!out.contains("world"));
        assert_eq!(out.matches(REDACTED).count(), 2);
    }

    #[test]
    fn sanitize_db_clears_segment_text() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES ('p', 'Secret', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES ('f', 'p', 'MyFile', 'text', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text, uid) \
             VALUES ('f', 0, 0.0, 1.0, '转写机密', 'u1')",
            [],
        )
        .unwrap();
        sanitize_diagnostic_db(&conn).unwrap();
        let text: String = conn
            .query_row("SELECT text FROM segments WHERE file_id = 'f'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(text, REDACTED);
        let pname: String = conn
            .query_row("SELECT name FROM projects WHERE id = 'p'", [], |r| r.get(0))
            .unwrap();
        assert!(pname.starts_with("project-"));
    }
}

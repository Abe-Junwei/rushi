use rusqlite::Connection;

pub(crate) fn table_columns(conn: &Connection, table: &str) -> rusqlite::Result<Vec<String>> {
    if !matches!(
        table,
        "segments" | "files" | "projects" | "glossary_terms" | "edit_log_snapshots"
    ) {
        return Err(rusqlite::Error::InvalidParameterName(table.to_string()));
    }
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let names = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

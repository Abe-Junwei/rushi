use rusqlite::Connection;

use super::super::columns::table_columns;

pub(crate) fn migrate_glossary_p2(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS glossary_terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT NOT NULL COLLATE NOCASE UNIQUE,
            created_at_ms INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_glossary_terms_created ON glossary_terms(created_at_ms);
        "#,
    )?;
    Ok(())
}

pub(crate) fn migrate_glossary_gly2(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "glossary_terms")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "note") {
        conn.execute(
            "ALTER TABLE glossary_terms ADD COLUMN note TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "aliases") {
        conn.execute(
            "ALTER TABLE glossary_terms ADD COLUMN aliases TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "domain") {
        conn.execute(
            "ALTER TABLE glossary_terms ADD COLUMN domain TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "updated_at_ms") {
        conn.execute(
            "ALTER TABLE glossary_terms ADD COLUMN updated_at_ms INTEGER",
            [],
        )?;
        conn.execute(
            "UPDATE glossary_terms SET updated_at_ms = created_at_ms WHERE updated_at_ms IS NULL",
            [],
        )?;
    }
    Ok(())
}

pub(crate) fn migrate_glossary_gly3(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "glossary_terms")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "hotword_enabled") {
        conn.execute(
            "ALTER TABLE glossary_terms ADD COLUMN hotword_enabled INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_glossary_terms_hotword ON glossary_terms(hotword_enabled);",
    )?;
    Ok(())
}

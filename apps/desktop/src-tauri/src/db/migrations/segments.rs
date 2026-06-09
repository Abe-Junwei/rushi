use rusqlite::Connection;

use super::super::columns::table_columns;

pub(crate) fn migrate_segments_p2(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "confidence") {
        conn.execute("ALTER TABLE segments ADD COLUMN confidence REAL", [])?;
    }
    if !cols.iter().any(|c| c == "low_confidence") {
        conn.execute(
            "ALTER TABLE segments ADD COLUMN low_confidence INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "detail") {
        conn.execute(
            "ALTER TABLE segments ADD COLUMN detail TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    Ok(())
}

pub(crate) fn migrate_segments_uid(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "uid") {
        conn.execute("ALTER TABLE segments ADD COLUMN uid TEXT", [])?;
    }
    let mut stmt = conn.prepare("SELECT id FROM segments WHERE uid IS NULL OR trim(uid) = ''")?;
    let ids = stmt
        .query_map([], |row| row.get::<_, i64>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for row_id in ids {
        let uid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "UPDATE segments SET uid = ?1 WHERE id = ?2",
            rusqlite::params![uid, row_id],
        )?;
    }
    conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_segments_file_uid ON segments(file_id, uid);",
    )?;
    Ok(())
}

pub(crate) fn migrate_segments_kind(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "kind") {
        conn.execute("ALTER TABLE segments ADD COLUMN kind TEXT", [])?;
    }
    Ok(())
}

pub(crate) fn migrate_segments_annotation(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "annotation") {
        conn.execute(
            "ALTER TABLE segments ADD COLUMN annotation TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }
    Ok(())
}

pub(crate) fn migrate_segments_text_stage(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "text_stage") {
        conn.execute(
            "ALTER TABLE segments ADD COLUMN text_stage TEXT NOT NULL DEFAULT 'auto_transcribe'",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "finalize_via") {
        conn.execute("ALTER TABLE segments ADD COLUMN finalize_via TEXT", [])?;
    }
    Ok(())
}

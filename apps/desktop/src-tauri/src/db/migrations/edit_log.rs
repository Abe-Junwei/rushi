use rusqlite::Connection;

use super::super::columns::table_columns;

pub(super) fn migrate_edit_log_snapshots(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS edit_log_snapshots (
            edit_log_id INTEGER PRIMARY KEY,
            file_id TEXT NOT NULL,
            segments_json TEXT NOT NULL,
            segment_count INTEGER NOT NULL,
            FOREIGN KEY (edit_log_id) REFERENCES edit_log(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_edit_log_snapshots_file ON edit_log_snapshots(file_id);
        "#,
    )?;
    migrate_edit_log_snapshots_schema(conn)?;
    Ok(())
}

fn migrate_edit_log_snapshots_schema(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "edit_log_snapshots")?;
    if !cols.iter().any(|c| c == "schema_version") {
        conn.execute(
            "ALTER TABLE edit_log_snapshots ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }
    Ok(())
}

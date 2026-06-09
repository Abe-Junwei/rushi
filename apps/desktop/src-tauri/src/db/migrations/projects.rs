use rusqlite::Connection;

use super::super::columns::table_columns;

pub(super) fn migrate_projects_metadata(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "projects")?;
    if cols.is_empty() {
        return Ok(());
    }
    for col in [
        "narrator",
        "recorded_at",
        "location",
        "subject",
        "transcriber",
    ] {
        if !cols.iter().any(|c| c == col) {
            conn.execute(&format!("ALTER TABLE projects ADD COLUMN {col} TEXT"), [])?;
        }
    }
    Ok(())
}

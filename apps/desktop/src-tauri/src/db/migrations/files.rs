use rusqlite::Connection;

use super::super::columns::table_columns;

pub(super) fn migrate_files_import_provenance(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "files")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "import_source_path") {
        conn.execute("ALTER TABLE files ADD COLUMN import_source_path TEXT", [])?;
    }
    if !cols.iter().any(|c| c == "import_content_sha256") {
        conn.execute(
            "ALTER TABLE files ADD COLUMN import_content_sha256 TEXT",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "import_source_size") {
        conn.execute(
            "ALTER TABLE files ADD COLUMN import_source_size INTEGER",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "import_source_modified_ms") {
        conn.execute(
            "ALTER TABLE files ADD COLUMN import_source_modified_ms INTEGER",
            [],
        )?;
    }
    if let Err(e) = crate::project::import_duplicate::backfill_files_import_provenance(conn) {
        eprintln!("[db] backfill_files_import_provenance: {e}");
    }
    Ok(())
}

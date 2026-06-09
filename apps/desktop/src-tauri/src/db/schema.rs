use rusqlite::Connection;

use super::columns::table_columns;

/// Greenfield: if an old project-centric projects table (with audio_storage_path) exists,
/// drop all dependent tables so the new file-centric schema can be created.
pub(super) fn ensure_projects_schema_v2(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "projects")?;
    if !cols.is_empty() && cols.iter().any(|c| c == "audio_storage_path") {
        conn.execute("PRAGMA foreign_keys = OFF", [])?;
        conn.execute("DROP TABLE IF EXISTS segments", [])?;
        conn.execute("DROP TABLE IF EXISTS files", [])?;
        conn.execute("DROP TABLE IF EXISTS edit_log", [])?;
        conn.execute("DROP TABLE IF EXISTS projects", [])?;
        conn.execute("PRAGMA foreign_keys = ON", [])?;
    }
    Ok(())
}

/// Greenfield: if an old project-centric segments table (without file_id) exists,
/// drop it so the new file-centric schema can be created.
pub(super) fn ensure_segments_schema_v2(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if !cols.is_empty() && !cols.iter().any(|c| c == "file_id") {
        conn.execute("DROP INDEX IF EXISTS idx_segments_file", [])?;
        conn.execute("DROP TABLE IF EXISTS segments", [])?;
    }
    Ok(())
}

pub(super) fn create_base_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            file_type TEXT NOT NULL CHECK(file_type IN ('text', 'paired', 'audio_only')),
            audio_path TEXT,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

        CREATE TABLE IF NOT EXISTS segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL,
            idx INTEGER NOT NULL,
            start_sec REAL NOT NULL DEFAULT 0,
            end_sec REAL NOT NULL DEFAULT 0,
            text TEXT NOT NULL DEFAULT '',
            confidence REAL,
            low_confidence INTEGER NOT NULL DEFAULT 0,
            detail TEXT NOT NULL DEFAULT '',
            uid TEXT NOT NULL DEFAULT '',
            kind TEXT,
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
            UNIQUE (file_id, idx)
        );
        CREATE INDEX IF NOT EXISTS idx_segments_file ON segments(file_id);

        CREATE TABLE IF NOT EXISTS edit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            at_ms INTEGER NOT NULL,
            kind TEXT NOT NULL,
            detail TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        "#,
    )?;
    Ok(())
}

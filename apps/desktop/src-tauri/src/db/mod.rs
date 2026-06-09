//! SQLite schema and migration for file-container projects (greenfield).
//! Projects are containers; files hold segments and optional audio.

mod columns;
mod migrations;
mod schema;

use rusqlite::Connection;

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    schema::ensure_projects_schema_v2(conn)?;
    schema::ensure_segments_schema_v2(conn)?;
    schema::create_base_tables(conn)?;
    migrations::run_incremental(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::columns::table_columns;
    use crate::db::migrations::glossary::{
        migrate_glossary_gly2, migrate_glossary_gly3, migrate_glossary_p2,
    };
    use crate::db::migrations::segments::{migrate_segments_p2, migrate_segments_uid};
    use rusqlite::Connection;

    #[test]
    fn migrate_projects_metadata_adds_columns() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let cols = table_columns(&conn, "projects").unwrap();
        assert!(cols.contains(&"narrator".to_string()));
        assert!(cols.contains(&"recorded_at".to_string()));
        assert!(cols.contains(&"location".to_string()));
        assert!(cols.contains(&"subject".to_string()));
        assert!(cols.contains(&"transcriber".to_string()));
        migrate(&conn).unwrap();
    }

    #[test]
    fn migrate_files_import_provenance_adds_columns() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let cols = table_columns(&conn, "files").unwrap();
        assert!(cols.contains(&"import_source_path".to_string()));
        assert!(cols.contains(&"import_content_sha256".to_string()));
        assert!(cols.contains(&"import_source_size".to_string()));
        assert!(cols.contains(&"import_source_modified_ms".to_string()));
        migrate(&conn).unwrap();
    }

    #[test]
    fn migrate_creates_all_tables() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(tables.contains(&"projects".to_string()));
        assert!(tables.contains(&"files".to_string()));
        assert!(tables.contains(&"segments".to_string()));
        assert!(tables.contains(&"edit_log".to_string()));
        assert!(tables.contains(&"edit_log_snapshots".to_string()));
        assert!(tables.contains(&"glossary_terms".to_string()));
        assert!(tables.contains(&"correction_memory".to_string()));
    }

    #[test]
    fn migrate_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
    }

    #[test]
    fn migrate_glossary_gly2_adds_metadata_columns() {
        let conn = Connection::open_in_memory().unwrap();
        migrate_glossary_p2(&conn).unwrap();
        let cols_before = table_columns(&conn, "glossary_terms").unwrap();
        assert!(!cols_before.iter().any(|c| c == "note"));

        migrate_glossary_gly2(&conn).unwrap();
        migrate_glossary_gly2(&conn).unwrap();

        let cols = table_columns(&conn, "glossary_terms").unwrap();
        assert!(cols.contains(&"note".to_string()));
        assert!(cols.contains(&"aliases".to_string()));
        assert!(cols.contains(&"domain".to_string()));
        assert!(cols.contains(&"updated_at_ms".to_string()));
    }

    #[test]
    fn migrate_glossary_gly3_adds_hotword_enabled() {
        let conn = Connection::open_in_memory().unwrap();
        migrate_glossary_p2(&conn).unwrap();
        migrate_glossary_gly2(&conn).unwrap();
        migrate_glossary_gly3(&conn).unwrap();
        migrate_glossary_gly3(&conn).unwrap();
        let cols = table_columns(&conn, "glossary_terms").unwrap();
        assert!(cols.contains(&"hotword_enabled".to_string()));
    }

    #[test]
    fn migrate_segments_p2_adds_columns_to_existing_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                start_sec REAL NOT NULL DEFAULT 0,
                end_sec REAL NOT NULL DEFAULT 0,
                text TEXT NOT NULL DEFAULT ''
            );
            "#,
        )
        .unwrap();

        migrate_segments_p2(&conn).unwrap();

        let cols = table_columns(&conn, "segments").unwrap();
        assert!(cols.contains(&"confidence".to_string()));
        assert!(cols.contains(&"low_confidence".to_string()));
        assert!(cols.contains(&"detail".to_string()));
    }

    #[test]
    fn migrate_drops_old_segments_table_without_file_id() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE projects (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL
            );
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                start_sec REAL NOT NULL DEFAULT 0,
                end_sec REAL NOT NULL DEFAULT 0,
                text TEXT NOT NULL DEFAULT ''
            );
            "#,
        )
        .unwrap();

        migrate(&conn).unwrap();

        let cols = table_columns(&conn, "segments").unwrap();
        assert!(cols.contains(&"file_id".to_string()));
        assert!(!cols.contains(&"project_id".to_string()));
    }

    #[test]
    fn migrate_preserves_segments_with_file_id() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE files (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL
            );
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                start_sec REAL NOT NULL DEFAULT 0,
                end_sec REAL NOT NULL DEFAULT 0,
                text TEXT NOT NULL DEFAULT ''
            );
            "#,
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            ["f1", "p1", "test", "text", "0", "0"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["f1", "0", "0.0", "1.0", "hello"],
        )
        .unwrap();

        migrate(&conn).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM segments", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn migrate_drops_old_projects_table_with_audio_storage_path() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE projects (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                audio_storage_path TEXT NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL
            );
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                start_sec REAL NOT NULL DEFAULT 0,
                end_sec REAL NOT NULL DEFAULT 0,
                text TEXT NOT NULL DEFAULT ''
            );
            "#,
        )
        .unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, audio_storage_path, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["p1", "Old", "/tmp/audio.wav", "0", "0"],
        )
        .unwrap();

        migrate(&conn).unwrap();

        let cols = table_columns(&conn, "projects").unwrap();
        assert!(!cols.contains(&"audio_storage_path".to_string()));
        assert!(cols.contains(&"name".to_string()));

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn migrate_segments_uid_backfills_two_rows_same_file_before_unique_index() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE files (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL
            );
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                start_sec REAL NOT NULL DEFAULT 0,
                end_sec REAL NOT NULL DEFAULT 0,
                text TEXT NOT NULL DEFAULT ''
            );
            "#,
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            ["f1", "p1", "test", "text", "0", "0"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["f1", "0", "0.0", "1.0", "a"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["f1", "1", "1.0", "2.0", "b"],
        )
        .unwrap();

        migrate_segments_uid(&conn).unwrap();

        let uids: Vec<String> = conn
            .prepare("SELECT uid FROM segments WHERE file_id = 'f1' ORDER BY idx")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(uids.len(), 2);
        assert!(!uids[0].is_empty());
        assert!(!uids[1].is_empty());
        assert_ne!(uids[0], uids[1]);

        let index_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_segments_file_uid'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(index_count, 1);
    }
}

//! SQLite schema and migration for file-container projects (greenfield).
//! Projects are containers; files hold segments and optional audio.

use rusqlite::Connection;

fn table_columns(conn: &Connection, table: &str) -> rusqlite::Result<Vec<String>> {
    if !matches!(table, "segments" | "files" | "projects" | "glossary_terms") {
        return Err(rusqlite::Error::InvalidParameterName(table.to_string()));
    }
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let names = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

/// For compatibility: add P2 columns if segments table exists from an older schema.
fn migrate_segments_p2(conn: &Connection) -> rusqlite::Result<()> {
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

/// 语段稳定 uid：供波形 region 与按 uid upsert，避免保存时整表删插导致 id 漂移。
fn migrate_segments_uid(conn: &Connection) -> rusqlite::Result<()> {
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

/// 显式语段类型：旧库 segments 表补 `kind` 列（附加式，旧行为 NULL → 按缺省启发式判定）。
fn migrate_segments_kind(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "kind") {
        conn.execute("ALTER TABLE segments ADD COLUMN kind TEXT", [])?;
    }
    Ok(())
}

fn migrate_glossary_p2(conn: &Connection) -> rusqlite::Result<()> {
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

/// GLY-2: optional metadata aligned with future dictionary_entries subset.
fn migrate_glossary_gly2(conn: &Connection) -> rusqlite::Result<()> {
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

/// GLY-3: per-entry opt-in for ASR hotwords (default enabled for existing rows).
fn migrate_glossary_gly3(conn: &Connection) -> rusqlite::Result<()> {
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

fn migrate_correction_memory_p2(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS correction_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            before_text TEXT NOT NULL,
            after_text TEXT NOT NULL,
            hit_count INTEGER NOT NULL DEFAULT 1,
            accepted_as_rule INTEGER NOT NULL DEFAULT 0,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL,
            UNIQUE (before_text, after_text)
        );
        CREATE INDEX IF NOT EXISTS idx_correction_memory_hits ON correction_memory(hit_count DESC, updated_at_ms DESC);
        "#,
    )?;
    Ok(())
}

/// Greenfield: if an old project-centric projects table (with audio_storage_path) exists,
/// drop all dependent tables so the new file-centric schema can be created.
fn ensure_projects_schema_v2(conn: &Connection) -> rusqlite::Result<()> {
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
fn ensure_segments_schema_v2(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
    if !cols.is_empty() && !cols.iter().any(|c| c == "file_id") {
        conn.execute("DROP INDEX IF EXISTS idx_segments_file", [])?;
        conn.execute("DROP TABLE IF EXISTS segments", [])?;
    }
    Ok(())
}

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    ensure_projects_schema_v2(conn)?;
    ensure_segments_schema_v2(conn)?;
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
    migrate_segments_p2(conn)?;
    migrate_segments_uid(conn)?;
    migrate_segments_kind(conn)?;
    migrate_glossary_p2(conn)?;
    migrate_glossary_gly2(conn)?;
    migrate_glossary_gly3(conn)?;
    migrate_correction_memory_p2(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

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
        assert!(tables.contains(&"glossary_terms".to_string()));
        assert!(tables.contains(&"correction_memory".to_string()));
    }

    #[test]
    fn migrate_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap(); // 不应报错
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
        // Create a bare segments table (simulating an old schema without P2 columns)
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
        // Simulate old project-centric schema
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

        // Old data gone (greenfield)
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

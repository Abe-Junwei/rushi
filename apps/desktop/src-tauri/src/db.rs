//! SQLite schema and migration for P1 local projects (ADR-0001) + P2 segments / glossary.

use rusqlite::Connection;

fn table_columns(conn: &Connection, table: &str) -> rusqlite::Result<Vec<String>> {
    if table != "segments" {
        return Err(rusqlite::Error::InvalidParameterName(table.to_string()));
    }
    let mut stmt = conn.prepare("PRAGMA table_info(segments)")?;
    let names = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

fn migrate_segments_p2(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "segments")?;
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

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            audio_storage_path TEXT NOT NULL,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            idx INTEGER NOT NULL,
            start_sec REAL NOT NULL,
            end_sec REAL NOT NULL,
            text TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (project_id, idx)
        );

        CREATE TABLE IF NOT EXISTS edit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            at_ms INTEGER NOT NULL,
            kind TEXT NOT NULL,
            detail TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_segments_project ON segments(project_id);
        "#,
    )?;
    migrate_segments_p2(conn)?;
    migrate_glossary_p2(conn)?;
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
        assert!(tables.contains(&"segments".to_string()));
        assert!(tables.contains(&"edit_log".to_string()));
        assert!(tables.contains(&"glossary_terms".to_string()));
        assert!(tables.contains(&"correction_memory".to_string()));
    }

    #[test]
    fn migrate_segments_adds_columns() {
        let conn = Connection::open_in_memory().unwrap();
        // 先创建基础 schema（不含 P2 列）
        conn.execute_batch(
            r#"
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                start_sec REAL NOT NULL,
                end_sec REAL NOT NULL,
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
    fn migrate_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap(); // 不应报错
    }
}

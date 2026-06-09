use rusqlite::Connection;

pub(super) fn migrate_correction_memory_p2(conn: &Connection) -> rusqlite::Result<()> {
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

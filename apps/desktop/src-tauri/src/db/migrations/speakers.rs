use rusqlite::Connection;

use super::super::columns::table_columns;

pub(crate) fn migrate_speaker_diarization(conn: &Connection) -> rusqlite::Result<()> {
    let segment_cols = table_columns(conn, "segments")?;
    if !segment_cols.is_empty() && !segment_cols.iter().any(|c| c == "speaker_id") {
        conn.execute("ALTER TABLE segments ADD COLUMN speaker_id TEXT", [])?;
    }
    let file_cols = table_columns(conn, "files")?;
    if !file_cols.is_empty() && !file_cols.iter().any(|c| c == "diarization_run_id") {
        conn.execute("ALTER TABLE files ADD COLUMN diarization_run_id TEXT", [])?;
    }
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS file_speakers (
            file_id TEXT NOT NULL,
            speaker_id TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            display_name TEXT,
            created_at_ms INTEGER NOT NULL,
            updated_at_ms INTEGER NOT NULL,
            PRIMARY KEY (file_id, speaker_id),
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_file_speakers_ordinal
            ON file_speakers(file_id, ordinal);
        "#,
    )?;
    Ok(())
}

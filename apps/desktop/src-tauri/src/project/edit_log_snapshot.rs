//! Per-save segment snapshots for edit-log restore (REV-LOC B).

use super::types::SegmentDto;
use rusqlite::{params, Connection, Transaction};

pub const SNAPSHOTS_PER_FILE: i64 = 30;

/// Bump when snapshot JSON shape gains required fields (see `db::migrate_edit_log_snapshots_schema`).
pub const EDIT_LOG_SNAPSHOT_SCHEMA_VERSION: i32 = 1;

pub fn insert_snapshot(
    tx: &Transaction<'_>,
    edit_log_id: i64,
    file_id: &str,
    segments: &[SegmentDto],
) -> Result<(), String> {
    let segments_json = serde_json::to_string(segments).map_err(|e| e.to_string())?;
    let segment_count = segments.len() as i64;
    tx.execute(
        "INSERT INTO edit_log_snapshots (edit_log_id, file_id, segments_json, segment_count, schema_version) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            edit_log_id,
            file_id,
            segments_json,
            segment_count,
            EDIT_LOG_SNAPSHOT_SCHEMA_VERSION,
        ],
    )
    .map_err(|e| e.to_string())?;
    prune_snapshots_for_file(tx, file_id)?;
    Ok(())
}

fn prune_snapshots_for_file(tx: &Transaction<'_>, file_id: &str) -> Result<(), String> {
    tx.execute(
        "DELETE FROM edit_log_snapshots WHERE file_id = ?1 AND edit_log_id NOT IN (
            SELECT edit_log_id FROM edit_log_snapshots WHERE file_id = ?1
            ORDER BY edit_log_id DESC LIMIT ?2
        )",
        params![file_id, SNAPSHOTS_PER_FILE],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_snapshot(
    conn: &Connection,
    edit_log_id: i64,
    file_id: &str,
) -> Result<Vec<SegmentDto>, String> {
    let (stored_file, json): (String, String) = conn
        .query_row(
            "SELECT file_id, segments_json FROM edit_log_snapshots WHERE edit_log_id = ?1",
            params![edit_log_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    if stored_file != file_id {
        return Err("快照与当前文件不匹配".into());
    }
    serde_json::from_str(&json).map_err(|e| format!("快照解析失败: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::Connection;
    use uuid::Uuid;

    fn seg(text: &str) -> SegmentDto {
        SegmentDto {
            uid: Some(Uuid::new_v4().to_string()),
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: text.to_string(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
        }
    }

    #[test]
    fn insert_and_load_snapshot_roundtrip() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES ('p', 'P', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES ('f', 'p', 'f', 'text', 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES ('p', 1, 'save_segments', '{}')",
            [],
        )
        .unwrap();
        let edit_log_id = conn.last_insert_rowid();
        let tx = conn.unchecked_transaction().unwrap();
        insert_snapshot(&tx, edit_log_id, "f", &[seg("甲")]).unwrap();
        tx.commit().unwrap();
        let schema_version: i32 = conn
            .query_row(
                "SELECT schema_version FROM edit_log_snapshots WHERE edit_log_id = ?1",
                [edit_log_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(schema_version, EDIT_LOG_SNAPSHOT_SCHEMA_VERSION);
        let loaded = load_snapshot(&conn, edit_log_id, "f").unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].text, "甲");
    }
}

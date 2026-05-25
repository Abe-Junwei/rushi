//! Integration tests for segment save (uid upsert + idx reorder).

use super::segment_cmd::file_save_segments_inner;
use super::types::SegmentDto;
use super::utils::{file_detail_from_conn, now_ms, open_db};
use crate::db;
use crate::DbState;
use rusqlite::params;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

fn test_root(label: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!("rushi_segment_cmd_{label}_{unique}"));
    fs::create_dir_all(&root).unwrap();
    root
}

fn test_state(label: &str) -> DbState {
    let root = test_root(label);
    let db_path = root.join("rushi.sqlite3");
    let conn = rusqlite::Connection::open(&db_path).unwrap();
    db::migrate(&conn).unwrap();
    drop(conn);
    DbState { root, db_path }
}

fn seed_file(st: &DbState) -> (String, String) {
    let project_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, "Project", t, t],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, "file.txt", "text", t, t],
    )
    .unwrap();
    (project_id, file_id)
}

fn seg(uid: &str, idx: i32, text: &str) -> SegmentDto {
    SegmentDto {
        uid: Some(uid.to_string()),
        idx,
        start_sec: idx as f64,
        end_sec: idx as f64 + 1.0,
        text: text.to_string(),
        confidence: None,
        low_confidence: false,
        detail: None,
    }
}

#[test]
fn file_save_segments_swaps_idx_without_unique_violation() {
    let st = test_state("swap_idx");
    let (_project_id, file_id) = seed_file(&st);
    let uid_a = Uuid::new_v4().to_string();
    let uid_b = Uuid::new_v4().to_string();

    file_save_segments_inner(&st, &file_id, &[seg(&uid_a, 0, "a"), seg(&uid_b, 1, "b")]).unwrap();

    file_save_segments_inner(&st, &file_id, &[seg(&uid_a, 1, "a"), seg(&uid_b, 0, "b")]).unwrap();

    let detail = file_detail_from_conn(&open_db(&st).unwrap(), &file_id).unwrap();
    assert_eq!(detail.segments.len(), 2);
    let by_uid: std::collections::HashMap<_, _> = detail
        .segments
        .iter()
        .map(|s| (s.uid.clone().unwrap(), s.idx))
        .collect();
    assert_eq!(by_uid.get(&uid_a).copied(), Some(1));
    assert_eq!(by_uid.get(&uid_b).copied(), Some(0));
}

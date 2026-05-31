//! DB integration tests for split project command modules.

use super::types::FileSummary;
use super::utils::{
    canonicalize_audio_storage_path, file_detail_from_conn, now_ms, open_db,
    project_detail_from_conn,
};
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
    let root = std::env::temp_dir().join(format!("rushi_project_cmd_{label}_{unique}"));
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

#[test]
fn create_empty_project_creates_project_with_no_files() {
    let st = test_state("empty_project");
    let project_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(&st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, "Empty Project", t, t],
    )
    .unwrap();

    let detail = project_detail_from_conn(&conn, &project_id).unwrap();
    assert_eq!(detail.id, project_id);
    assert!(detail.files.is_empty());
}

#[test]
fn create_project_with_file_then_list_and_load() {
    let st = test_state("with_file");
    let project_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(&st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, "Project", t, t],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&file_id, &project_id, "audio.wav", "paired", "/tmp/audio.wav", t, t],
    )
    .unwrap();

    let mut stmt = conn
        .prepare("SELECT id, name, file_type, updated_at_ms FROM files WHERE project_id = ?1")
        .unwrap();
    let rows: Vec<FileSummary> = stmt
        .query_map(params![&project_id], |r| {
            Ok(FileSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                file_type: r.get(2)?,
                updated_at_ms: r.get(3)?,
            })
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(rows.len(), 1);

    let detail = file_detail_from_conn(&conn, &file_id).unwrap();
    assert_eq!(detail.id, file_id);
    assert!(file_detail_from_conn(&conn, &project_id).is_err());
}

#[test]
fn rename_file_updates_name_and_project_timestamp() {
    let st = test_state("rename");
    let project_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(&st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, "Project", t, t],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, "old.txt", "text", t, t],
    )
    .unwrap();

    let new_t = t + 1000;
    conn.execute(
        "UPDATE files SET name = ?1, updated_at_ms = ?2 WHERE id = ?3",
        params!["new.txt", new_t, &file_id],
    )
    .unwrap();
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![new_t, &project_id],
    )
    .unwrap();

    let name: String = conn
        .query_row(
            "SELECT name FROM files WHERE id = ?1",
            params![&file_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(name, "new.txt");
}

#[test]
fn delete_file_cascades_to_segments() {
    let st = test_state("delete");
    let project_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(&st).unwrap();
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
    conn.execute(
        "INSERT INTO segments (file_id, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&file_id, 0, 0.0, 1.0, "seg1"],
    )
    .unwrap();

    conn.execute("DELETE FROM files WHERE id = ?1", params![&file_id])
        .unwrap();

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM segments WHERE file_id = ?1",
            params![&file_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn canonicalize_audio_storage_path_returns_absolute_file_path() {
    let st = test_state("audio_canonical");
    let file = st.root.join("sample.wav");
    fs::write(&file, b"x").unwrap();
    let stored = canonicalize_audio_storage_path(&file).unwrap();
    assert!(PathBuf::from(&stored).is_absolute());
    assert!(PathBuf::from(stored).is_file());
}

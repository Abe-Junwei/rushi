use super::hash::file_sha256_hex;
use super::path_meta::normalize_import_source_path;
use super::{backfill_files_import_provenance, check_import_duplicate_inner};
use crate::db;
use crate::project::import_parse::parse_txt;
use rusqlite::Connection;
use std::fs;
use uuid::Uuid;

#[allow(clippy::too_many_arguments)]
fn seed_project_with_file(
    conn: &Connection,
    project_id: &str,
    file_id: &str,
    name: &str,
    file_type: &str,
    source_path: Option<&str>,
    content_hash: Option<&str>,
    audio_path: Option<&str>,
) {
    let t = 1_i64;
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![project_id, "P", t, t],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, import_source_path, import_content_sha256, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            file_id,
            project_id,
            name,
            file_type,
            audio_path,
            source_path,
            content_hash,
            t,
            t,
        ],
    )
    .unwrap();
}

fn seed_text_segments(conn: &Connection, file_id: &str, text: &str) {
    conn.execute(
        "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![file_id, "uid-1", 0, 0.0, 1.0, text],
    )
    .unwrap();
}

#[test]
fn detects_duplicate_by_stored_source_path() {
    let conn = Connection::open_in_memory().unwrap();
    db::migrate(&conn).unwrap();
    let root = std::env::temp_dir().join(format!("rushi-import-dup-{}", Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let src = root.join("clip.wav");
    fs::write(&src, b"wav-bytes").unwrap();
    let canonical = normalize_import_source_path(src.to_str().unwrap());

    seed_project_with_file(
        &conn,
        "p1",
        "f1",
        "clip",
        "paired",
        Some(&canonical),
        None,
        None,
    );

    let check = check_import_duplicate_inner(&conn, "p1", src.to_str().unwrap(), None).unwrap();
    assert_eq!(check.by_source_path.len(), 1);
    assert_eq!(check.by_source_path[0].file_name, "clip");
    assert!(check.by_content_hash.is_empty());

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn detects_duplicate_by_content_hash_when_paths_differ() {
    let conn = Connection::open_in_memory().unwrap();
    db::migrate(&conn).unwrap();
    let root = std::env::temp_dir().join(format!("rushi-import-dup-{}", Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let existing = root.join("stored.wav");
    let incoming = root.join("incoming.wav");
    fs::write(&existing, b"same-content").unwrap();
    fs::write(&incoming, b"same-content").unwrap();
    let hash = file_sha256_hex(&existing).unwrap();

    seed_project_with_file(
        &conn,
        "p1",
        "f1",
        "stored",
        "paired",
        None,
        Some(&hash),
        Some(existing.to_str().unwrap()),
    );

    let check =
        check_import_duplicate_inner(&conn, "p1", incoming.to_str().unwrap(), None).unwrap();
    assert!(check.by_source_path.is_empty());
    assert_eq!(check.by_content_hash.len(), 1);
    assert_eq!(check.by_content_hash[0].file_name, "stored");

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn detects_legacy_text_duplicate_by_segment_fingerprint() {
    let conn = Connection::open_in_memory().unwrap();
    db::migrate(&conn).unwrap();
    let root = std::env::temp_dir().join(format!("rushi-import-dup-{}", Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let incoming = root.join("notes.txt");
    let content = "hello world";
    fs::write(&incoming, content.as_bytes()).unwrap();

    seed_project_with_file(&conn, "p1", "f1", "notes", "text", None, None, None);
    let parsed = parse_txt(content);
    for s in &parsed {
        conn.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params!["f1", "uid-1", s.idx, s.start_sec, s.end_sec, s.text],
        )
        .unwrap();
    }

    let check =
        check_import_duplicate_inner(&conn, "p1", incoming.to_str().unwrap(), None).unwrap();
    assert!(check.by_source_path.is_empty());
    assert_eq!(check.by_content_hash.len(), 1);

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn skips_audio_rehash_when_stored_hash_differs() {
    let conn = Connection::open_in_memory().unwrap();
    db::migrate(&conn).unwrap();
    let root = std::env::temp_dir().join(format!("rushi-import-dup-{}", Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let stored_audio = root.join("stored.wav");
    let incoming = root.join("incoming.wav");
    fs::write(&stored_audio, b"stored-bytes").unwrap();
    fs::write(&incoming, b"incoming-bytes").unwrap();

    seed_project_with_file(
        &conn,
        "p1",
        "f1",
        "stored",
        "paired",
        None,
        Some("deadbeef"),
        Some(stored_audio.to_str().unwrap()),
    );

    let check =
        check_import_duplicate_inner(&conn, "p1", incoming.to_str().unwrap(), None).unwrap();
    assert!(check.by_content_hash.is_empty());

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn replace_target_bypasses_same_file_source_path_match() {
    let conn = Connection::open_in_memory().unwrap();
    db::migrate(&conn).unwrap();
    let root = std::env::temp_dir().join(format!("rushi-import-dup-{}", Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let src = root.join("interview.srt");
    fs::write(&src, b"1\n00:00:01,000 --> 00:00:02,000\nHi\n").unwrap();
    let canonical = normalize_import_source_path(src.to_str().unwrap());

    seed_project_with_file(
        &conn,
        "p1",
        "f1",
        "interview",
        "paired",
        Some(&canonical),
        None,
        Some("/tmp/interview.wav"),
    );

    let check =
        check_import_duplicate_inner(&conn, "p1", src.to_str().unwrap(), Some("f1")).unwrap();
    assert!(check.by_source_path.is_empty());
    assert!(check.by_content_hash.is_empty());

    let check_other =
        check_import_duplicate_inner(&conn, "p1", src.to_str().unwrap(), None).unwrap();
    assert_eq!(check_other.by_source_path.len(), 1);

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn backfill_sets_legacy_text_fingerprint() {
    let conn = Connection::open_in_memory().unwrap();
    db::migrate(&conn).unwrap();
    seed_project_with_file(&conn, "p1", "f1", "notes", "text", None, None, None);
    seed_text_segments(&conn, "f1", "legacy text");

    backfill_files_import_provenance(&conn).unwrap();

    let hash: String = conn
        .query_row(
            "SELECT import_content_sha256 FROM files WHERE id = 'f1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(!hash.is_empty());
}

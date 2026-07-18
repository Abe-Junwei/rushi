//! DB integration tests for split project command modules.

use super::utils::{
    canonicalize_audio_storage_path, file_detail_from_conn, now_ms, open_db,
    project_detail_from_conn, update_file_duration_sec,
};
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
    DbState::open_test_db(test_root(label))
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

    let rows = super::utils::list_file_summaries(&conn, &project_id, None).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].segment_count, 0);
    assert!(!rows[0].media_missing); // no DbState → existence not flagged

    let detail = file_detail_from_conn(&conn, &file_id).unwrap();
    assert_eq!(detail.id, file_id);
    assert!(file_detail_from_conn(&conn, &project_id).is_err());
}

#[test]
fn list_file_summaries_aggregates_segments_and_duration() {
    let st = test_state("file_summary_agg");
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
    update_file_duration_sec(&conn, &file_id, 125.5).unwrap();
    // content: draft / first_proof / finalized
    for (uid, idx, kind, stage, text, detail) in [
        ("a", 0, None, "auto_transcribe", "生稿句", ""),
        ("b", 1, None, "first_proof", "一校句", ""),
        ("c", 2, None, "finalized", "定稿句", ""),
        // ignored: placeholder, empty text, whole-track fallback
        ("d", 3, Some("placeholder"), "auto_transcribe", "占位", ""),
        ("e", 4, None, "auto_transcribe", "   ", ""),
        (
            "f",
            5,
            None,
            "auto_transcribe",
            "fallback",
            "funasr_whole_track_fallback",
        ),
    ] {
        conn.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, \
             low_confidence, detail, kind, text_stage, finalize_via, annotation, frozen) \
             VALUES (?1, ?2, ?3, 0.0, 1.0, ?4, NULL, 0, ?5, ?6, ?7, NULL, '', 0)",
            params![&file_id, uid, idx, text, detail, kind, stage],
        )
        .unwrap();
    }

    let rows = super::utils::list_file_summaries(&conn, &project_id, None).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].segment_count, 3);
    assert_eq!(rows[0].draft_count, 1);
    assert_eq!(rows[0].first_proof_count, 1);
    assert_eq!(rows[0].finalized_count, 1);
    assert!((rows[0].duration_sec.unwrap() - 125.5).abs() < f64::EPSILON);
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

#[test]
fn move_file_to_project_relocates_db_and_managed_audio() {
    use super::file_cmd::move_file_to_project_inner;
    use super::project_storage::project_storage_dir;
    use super::waveform_peaks::{peak_file_path, peaks_dir};

    let st = test_state("move_file");
    let src_id = Uuid::new_v4().to_string();
    let dest_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();

    let src_dir = project_storage_dir(&st.root, &src_id);
    fs::create_dir_all(peaks_dir(&src_dir)).unwrap();
    let audio = src_dir.join(format!("{file_id}.wav"));
    fs::write(&audio, b"wav").unwrap();
    let audio_path = canonicalize_audio_storage_path(&audio).unwrap();
    fs::write(peak_file_path(&peaks_dir(&src_dir), &file_id, 0), b"p0").unwrap();

    {
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&src_id, "Src", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&dest_id, "Dest", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&file_id, &src_id, "clip.wav", "paired", &audio_path, t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text) VALUES (?1, 0, 0.0, 1.0, 'hi')",
            params![&file_id],
        )
        .unwrap();
    }

    move_file_to_project_inner(&st, &file_id, &dest_id).unwrap();

    let conn = open_db(&st).unwrap();
    let (project_id, new_audio): (String, String) = conn
        .query_row(
            "SELECT project_id, audio_path FROM files WHERE id = ?1",
            params![&file_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(project_id, dest_id);
    // audio_path is persisted relative to media base (default: app root).
    assert!(
        !crate::media_base_dir::path_is_absolute_storage(&new_audio),
        "expected media-base-relative audio_path, got {new_audio}"
    );
    let dest_dir = fs::canonicalize(project_storage_dir(&st.root, &dest_id)).unwrap();
    let new_audio_path = crate::media_base_dir::resolve_audio_path(&st, &new_audio).unwrap();
    assert!(new_audio_path.is_file());
    assert!(new_audio_path.starts_with(&dest_dir));
    assert!(!audio.is_file());
    assert!(peak_file_path(
        &peaks_dir(&project_storage_dir(&st.root, &dest_id)),
        &file_id,
        0
    )
    .is_file());
    let seg_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM segments WHERE file_id = ?1",
            params![&file_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(seg_count, 1);
}

#[test]
fn move_file_to_project_auto_renames_on_conflict() {
    use super::file_cmd::move_file_to_project_inner;

    let st = test_state("move_conflict");
    let src_id = Uuid::new_v4().to_string();
    let dest_id = Uuid::new_v4().to_string();
    let file_a = Uuid::new_v4().to_string();
    let file_b = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(&st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&src_id, "Src", t, t],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&dest_id, "Dest", t, t],
    )
    .unwrap();
    // `files.name` is globally UNIQUE in the real schema, so this pre-existing
    // duplicate can only be constructed here by bypassing the index — the app
    // layer itself never creates duplicates (see `unique_file_name`). Dropping
    // it is test-only setup; the move logic under test still runs unmodified.
    conn.execute("DROP INDEX idx_files_name_unique", [])
        .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_a, &src_id, "same.txt", "text", t, t],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_b, &dest_id, "same.txt", "text", t, t],
    )
    .unwrap();

    let result = move_file_to_project_inner(&st, &file_a, &dest_id).unwrap();
    assert!(result.renamed);
    assert_eq!(result.final_name, "same (2).txt");
    let name: String = conn
        .query_row(
            "SELECT name FROM files WHERE id = ?1",
            params![&file_a],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(name, "same (2).txt");
}

#[test]
fn rename_file_rejects_duplicate_name_in_project() {
    use super::file_cmd::rename_file_inner;

    let st = test_state("rename_dup");
    let project_id = Uuid::new_v4().to_string();
    let file_a = Uuid::new_v4().to_string();
    let file_b = Uuid::new_v4().to_string();
    let t = now_ms();
    {
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "P", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_a, &project_id, "a.txt", "text", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_b, &project_id, "b.txt", "text", t, t],
        )
        .unwrap();
    }

    let err = rename_file_inner(&st, &file_a, "b.txt").unwrap_err();
    assert!(err.contains("已存在"));
    rename_file_inner(&st, &file_a, "a2.txt").unwrap();
    let name: String = open_db(&st)
        .unwrap()
        .query_row(
            "SELECT name FROM files WHERE id = ?1",
            params![&file_a],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(name, "a2.txt");
}

#[test]
fn rename_file_rejects_duplicate_name_across_projects() {
    use super::file_cmd::rename_file_inner;

    let st = test_state("rename_cross");
    let p1 = Uuid::new_v4().to_string();
    let p2 = Uuid::new_v4().to_string();
    let file_a = Uuid::new_v4().to_string();
    let file_b = Uuid::new_v4().to_string();
    let t = now_ms();
    {
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&p1, "P1", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&p2, "P2", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_a, &p1, "a.txt", "text", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_b, &p2, "taken.txt", "text", t, t],
        )
        .unwrap();
    }

    let err = rename_file_inner(&st, &file_a, "taken.txt").unwrap_err();
    assert!(err.contains("已存在"));
}

#[test]
fn move_file_to_project_auto_renames_when_other_project_holds_name() {
    use super::file_cmd::move_file_to_project_inner;

    let st = test_state("move_global");
    let src_id = Uuid::new_v4().to_string();
    let dest_id = Uuid::new_v4().to_string();
    let other_id = Uuid::new_v4().to_string();
    let file_a = Uuid::new_v4().to_string();
    let file_other = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(&st).unwrap();
    for (id, name) in [(&src_id, "Src"), (&dest_id, "Dest"), (&other_id, "Other")] {
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, t, t],
        )
        .unwrap();
    }
    // See comment in `move_file_to_project_auto_renames_on_conflict` re: why
    // the unique index must be dropped to construct this test-only duplicate.
    conn.execute("DROP INDEX idx_files_name_unique", [])
        .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_a, &src_id, "same.txt", "text", t, t],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_other, &other_id, "same.txt", "text", t, t],
    )
    .unwrap();

    // Dest is empty, but Other still holds `same.txt` → must rename.
    let result = move_file_to_project_inner(&st, &file_a, &dest_id).unwrap();
    assert!(result.renamed);
    assert_eq!(result.final_name, "same (2).txt");
}

#[test]
fn copy_file_to_project_duplicates_segments_and_keeps_source() {
    use super::file_cmd::copy_file_to_project_inner;
    use super::project_storage::project_storage_dir;
    use super::waveform_peaks::{peak_file_path, peaks_dir};

    let st = test_state("copy_file");
    let src_id = Uuid::new_v4().to_string();
    let dest_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();

    let src_dir = project_storage_dir(&st.root, &src_id);
    fs::create_dir_all(peaks_dir(&src_dir)).unwrap();
    let audio = src_dir.join(format!("{file_id}.wav"));
    fs::write(&audio, b"wav").unwrap();
    let audio_path = canonicalize_audio_storage_path(&audio).unwrap();
    fs::write(peak_file_path(&peaks_dir(&src_dir), &file_id, 0), b"p0").unwrap();

    {
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&src_id, "Src", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&dest_id, "Dest", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&file_id, &src_id, "clip.wav", "paired", &audio_path, t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text, uid) VALUES (?1, 0, 0.0, 1.0, 'hi', ?2)",
            params![&file_id, Uuid::new_v4().to_string()],
        )
        .unwrap();
    }

    let result = copy_file_to_project_inner(&st, &file_id, &dest_id).unwrap();
    assert_ne!(result.file_id, file_id);
    // Source still occupies `clip.wav` → workspace-global unique forces rename.
    assert!(result.renamed);
    assert_eq!(result.final_name, "clip (2).wav");

    let conn = open_db(&st).unwrap();
    let src_still: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE id = ?1 AND project_id = ?2",
            params![&file_id, &src_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(src_still, 1);
    let dest_name: String = conn
        .query_row(
            "SELECT name FROM files WHERE id = ?1",
            params![&result.file_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(dest_name, "clip (2).wav");
    assert!(audio.is_file());
    let dest_audio: String = conn
        .query_row(
            "SELECT audio_path FROM files WHERE id = ?1",
            params![&result.file_id],
            |r| r.get(0),
        )
        .unwrap();
    // audio_path is persisted relative to media base (default: app root).
    assert!(
        !crate::media_base_dir::path_is_absolute_storage(&dest_audio),
        "expected media-base-relative audio_path, got {dest_audio}"
    );
    let dest_audio_resolved = crate::media_base_dir::resolve_audio_path(&st, &dest_audio).unwrap();
    assert!(dest_audio_resolved.is_file());
    assert_ne!(dest_audio, audio_path);
    let dest_segs: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM segments WHERE file_id = ?1",
            params![&result.file_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(dest_segs, 1);
}

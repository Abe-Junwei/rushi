use super::project_bundle_cmd::{
    export_project_bundle_to_path, import_project_bundle_from_path, read_zip_bytes, read_zip_json,
    zip_opts, ProjectBundleDocument, ProjectBundleManifest, ProjectBundleProjectMeta,
    PROJECT_BUNDLE_KIND, PROJECT_BUNDLE_VERSION,
};
use super::types::SegmentDto;
use super::utils::open_db;
use crate::db;
use crate::DbState;
use rusqlite::params;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use zip::{ZipArchive, ZipWriter};

fn test_root(label: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!("rushi_export_cmd_{label}_{unique}"));
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

struct SeededProject {
    file_id: String,
}

fn seed_project(st: &DbState, project_id: &str, name: &str, audio_name: &str) -> SeededProject {
    let project_dir = st.root.join("projects").join(project_id);
    fs::create_dir_all(&project_dir).unwrap();
    let audio_path = project_dir.join(audio_name);
    fs::write(&audio_path, b"test-audio-bytes").unwrap();
    let conn = open_db(st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, name, 11i64, 22i64],
    )
    .unwrap();
    let file_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &file_id,
            project_id,
            name,
            "paired",
            audio_path.to_string_lossy().to_string(),
            11i64,
            22i64
        ],
    )
    .unwrap();
    SeededProject { file_id }
}

#[test]
fn export_and_import_project_bundle_round_trip() {
    let export_state = test_state("round_trip_export");
    let project_id = "project-export-1";
    let seeded = seed_project(&export_state, project_id, "示例项目", "audio.wav");
    let export_zip = export_state.root.join("bundle.zip");
    let exported_segments = vec![
        SegmentDto {
            uid: None,
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.2,
            text: "第一句".into(),
            confidence: Some(0.9),
            low_confidence: false,
            detail: Some("ok".into()),
            kind: None,
        },
        SegmentDto {
            uid: None,
            idx: 1,
            start_sec: 1.2,
            end_sec: 2.4,
            text: "第二句".into(),
            confidence: None,
            low_confidence: true,
            detail: None,
            kind: None,
        },
    ];

    let written = export_project_bundle_to_path(
        &export_state,
        project_id,
        &seeded.file_id,
        &export_zip,
        exported_segments.clone(),
    )
    .unwrap();
    assert_eq!(written, export_zip.to_string_lossy().to_string());
    assert!(export_zip.is_file());

    let mut archive = ZipArchive::new(File::open(&export_zip).unwrap()).unwrap();
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json").unwrap();
    assert_eq!(manifest.kind, PROJECT_BUNDLE_KIND);
    assert_eq!(manifest.version, PROJECT_BUNDLE_VERSION);
    assert_eq!(manifest.project.original_id, project_id);
    assert_eq!(manifest.audio_file, "audio.wav");
    let doc: ProjectBundleDocument = read_zip_json(&mut archive, "project.json").unwrap();
    assert_eq!(doc.name, "示例项目");
    assert_eq!(doc.segments.len(), 2);
    assert_eq!(doc.segments[0].text, "第一句");
    let audio_bytes = read_zip_bytes(&mut archive, "audio/audio.wav").unwrap();
    assert_eq!(audio_bytes, b"test-audio-bytes");

    let import_state = test_state("round_trip_import");
    let imported = import_project_bundle_from_path(&import_state, &export_zip).unwrap();
    assert_eq!(imported.name, "示例项目");
    assert_ne!(imported.id, project_id);
    assert_eq!(imported.files.len(), 1);
    assert_eq!(imported.files[0].file_type, "paired");

    let conn = open_db(&import_state).unwrap();
    let imported_edit_kind: String = conn
        .query_row(
            "SELECT kind FROM edit_log WHERE project_id = ?1 ORDER BY id DESC LIMIT 1",
            params![&imported.id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(imported_edit_kind, "import_project_bundle");

    let _ = fs::remove_dir_all(&export_state.root);
    let _ = fs::remove_dir_all(&import_state.root);
}

#[test]
fn export_project_bundle_uses_requested_file_audio() {
    let st = test_state("export_file_pick");
    let project_id = "project-multi";
    let project_dir = st.root.join("projects").join(project_id);
    fs::create_dir_all(&project_dir).unwrap();
    let audio_a = project_dir.join("a.wav");
    let audio_b = project_dir.join("b.wav");
    fs::write(&audio_a, b"audio-A").unwrap();
    fs::write(&audio_b, b"audio-B").unwrap();
    let conn = open_db(&st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, "Multi", 1i64, 2i64],
    )
    .unwrap();
    let file_a = "file-a".to_string();
    let file_b = "file-b".to_string();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &file_a,
            project_id,
            "A",
            "paired",
            audio_a.to_string_lossy().to_string(),
            1i64,
            2i64
        ],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &file_b,
            project_id,
            "B",
            "paired",
            audio_b.to_string_lossy().to_string(),
            1i64,
            2i64
        ],
    )
    .unwrap();
    drop(conn);

    let zip_path = st.root.join("multi.zip");
    export_project_bundle_to_path(
        &st,
        project_id,
        &file_b,
        &zip_path,
        vec![SegmentDto {
            uid: None,
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: "B-only".into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
        }],
    )
    .unwrap();

    let mut archive = ZipArchive::new(File::open(&zip_path).unwrap()).unwrap();
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json").unwrap();
    assert_eq!(manifest.audio_file, "b.wav");
    let audio_bytes = read_zip_bytes(&mut archive, "audio/b.wav").unwrap();
    assert_eq!(audio_bytes, b"audio-B");
    let doc: ProjectBundleDocument = read_zip_json(&mut archive, "project.json").unwrap();
    assert_eq!(doc.segments[0].text, "B-only");

    let _ = fs::remove_dir_all(&st.root);
}

#[test]
fn import_project_bundle_rejects_unsafe_audio_path() {
    let st = test_state("unsafe_path");
    let zip_path = st.root.join("unsafe.zip");
    let file = File::create(&zip_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let manifest = ProjectBundleManifest {
        kind: PROJECT_BUNDLE_KIND.to_string(),
        version: PROJECT_BUNDLE_VERSION,
        exported_at_ms: 1,
        project: ProjectBundleProjectMeta {
            original_id: "source-id".into(),
            name: "原项目".into(),
            created_at_ms: 2,
            updated_at_ms: 3,
        },
        audio_file: "audio/../../evil.wav".into(),
    };
    let doc = ProjectBundleDocument {
        name: "导入项目".into(),
        created_at_ms: 2,
        updated_at_ms: 3,
        segments: vec![],
    };
    zip.start_file("manifest.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&manifest).unwrap())
        .unwrap();
    zip.start_file("project.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&doc).unwrap()).unwrap();
    zip.finish().unwrap();

    let err = import_project_bundle_from_path(&st, &zip_path).unwrap_err();
    assert!(err.contains("音频路径不安全"));

    let _ = fs::remove_dir_all(&st.root);
}

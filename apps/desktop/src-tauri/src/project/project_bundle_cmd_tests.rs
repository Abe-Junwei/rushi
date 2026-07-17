use super::project_bundle_cmd::{
    export_project_bundle_to_path, import_project_bundle_from_path, read_zip_bytes, read_zip_json,
    zip_opts, ProjectBundleDocument, ProjectBundleFileDoc, ProjectBundleFileManifest,
    ProjectBundleManifest, ProjectBundleProjectMeta, MAX_BUNDLE_SEGMENT_COUNT,
    MAX_BUNDLE_UNCOMPRESSED_BYTES, PROJECT_BUNDLE_KIND, PROJECT_BUNDLE_LEXICON_ENTRY,
    PROJECT_BUNDLE_VERSION, PROJECT_BUNDLE_VERSION_V1,
};
use super::types::SegmentDto;
use super::utils::open_db;
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
    DbState::open_test_db(test_root(label))
}

fn empty_project_meta(original_id: &str, name: &str) -> ProjectBundleProjectMeta {
    ProjectBundleProjectMeta {
        original_id: original_id.into(),
        name: name.into(),
        created_at_ms: 2,
        updated_at_ms: 3,
        narrator: None,
        recorded_at: None,
        location: None,
        subject: None,
        transcriber: None,
    }
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
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms, narrator, recorded_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![project_id, name, 11i64, 22i64, "讲述人甲", "2026-01-01"],
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
    conn.execute(
        "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, 15i64, "save_segments", "{\"n\":1}"],
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
            kind: Some("speech".into()),
            text_stage: "finalized".to_string(),
            finalize_via: Some("manual".into()),
            annotation: Some("note-a".into()),
            frozen: false,
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
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
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
    assert_eq!(manifest.project.narrator.as_deref(), Some("讲述人甲"));
    assert!(manifest.audio_file.is_none());
    assert!(manifest.includes_lexicon);
    assert_eq!(manifest.files.len(), 1);
    assert_eq!(manifest.files[0].original_file_id, seeded.file_id);
    let audio_entry = manifest.files[0].audio_entry.clone();
    assert!(audio_entry.starts_with("audio/"));
    let doc: ProjectBundleDocument = read_zip_json(&mut archive, "project.json").unwrap();
    assert_eq!(doc.name, "示例项目");
    assert!(doc.segments.is_empty());
    assert_eq!(doc.files.len(), 1);
    assert_eq!(doc.files[0].segments.len(), 2);
    assert_eq!(doc.files[0].segments[0].text, "第一句");
    assert_eq!(doc.edit_log.len(), 1);
    assert_eq!(doc.edit_log[0].kind, "save_segments");
    let audio_bytes = read_zip_bytes(&mut archive, &audio_entry).unwrap();
    assert_eq!(audio_bytes, b"test-audio-bytes");

    let import_state = test_state("round_trip_import");
    let imported = import_project_bundle_from_path(&import_state, &export_zip).unwrap();
    assert_eq!(imported.name, "示例项目");
    assert_ne!(imported.id, project_id);
    assert_eq!(imported.files.len(), 1);
    assert_eq!(imported.files[0].file_type, "paired");

    let conn = open_db(&import_state).unwrap();
    let narrator: Option<String> = conn
        .query_row(
            "SELECT narrator FROM projects WHERE id = ?1",
            params![&imported.id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(narrator.as_deref(), Some("讲述人甲"));

    let edit_kinds: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT kind FROM edit_log WHERE project_id = ?1 ORDER BY id ASC")
            .unwrap();
        stmt.query_map(params![&imported.id], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    };
    assert!(edit_kinds.contains(&"save_segments".to_string()));
    assert_eq!(edit_kinds.last().map(String::as_str), Some("import_project_bundle"));

    let (kind, text_stage, finalize_via, annotation): (
        Option<String>,
        String,
        Option<String>,
        String,
    ) = conn
        .query_row(
            "SELECT kind, text_stage, finalize_via, annotation FROM segments \
                 WHERE file_id = ?1 AND idx = 0",
            params![&imported.files[0].id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();
    assert_eq!(kind.as_deref(), Some("speech"));
    assert_eq!(text_stage, "finalized");
    assert_eq!(finalize_via.as_deref(), Some("manual"));
    assert_eq!(annotation, "note-a");

    let _ = fs::remove_dir_all(&export_state.root);
    let _ = fs::remove_dir_all(&import_state.root);
}

#[test]
fn project_bundle_embeds_and_imports_global_lexicon() {
    let export_state = test_state("lexicon_export");
    let project_id = "project-with-lexicon";
    let seeded = seed_project(&export_state, project_id, "词表项目", "clip.wav");
    {
        let conn = open_db(&export_state).unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, created_at_ms, updated_at_ms, hotword_enabled) \
             VALUES (?1, '', '', '', 1, 1, 1)",
            params!["专有名词甲"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 3, 1, 1, 1)",
            params!["错词", "正词"],
        )
        .unwrap();
    }
    let zip_path = export_state.root.join("with-lexicon.zip");
    export_project_bundle_to_path(
        &export_state,
        project_id,
        &seeded.file_id,
        &zip_path,
        vec![SegmentDto {
            uid: None,
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: "测".into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
        }],
    )
    .unwrap();

    let mut archive = ZipArchive::new(File::open(&zip_path).unwrap()).unwrap();
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json").unwrap();
    assert!(manifest.includes_lexicon);
    assert_eq!(manifest.kind, PROJECT_BUNDLE_KIND);
    let lexicon_raw = read_zip_bytes(&mut archive, PROJECT_BUNDLE_LEXICON_ENTRY).unwrap();
    let lexicon_json: serde_json::Value = serde_json::from_slice(&lexicon_raw).unwrap();
    assert_eq!(lexicon_json["kind"], "rushi_lexicon_bundle");
    assert!(lexicon_json["glossary_terms"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["term"] == "专有名词甲"));

    let import_state = test_state("lexicon_import");
    let _imported = import_project_bundle_from_path(&import_state, &zip_path).unwrap();
    let conn = open_db(&import_state).unwrap();
    let term_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM glossary_terms WHERE term = ?1",
            params!["专有名词甲"],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(term_count, 1);
    let rule_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM correction_memory WHERE before_text = ?1 AND after_text = ?2",
            params!["错词", "正词"],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rule_count, 1);

    let _ = fs::remove_dir_all(&export_state.root);
    let _ = fs::remove_dir_all(&import_state.root);
}

#[test]
fn export_project_bundle_packs_all_files_primary_segments_override() {
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
            2i64,
            3i64
        ],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail, kind, text_stage, finalize_via, annotation, frozen) \
         VALUES (?1, ?2, 0, 0.0, 1.0, 'A-from-db', NULL, 0, '', NULL, 'auto_transcribe', NULL, '', 0)",
        params![&file_a, "uid-a"],
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
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
        }],
    )
    .unwrap();

    let mut archive = ZipArchive::new(File::open(&zip_path).unwrap()).unwrap();
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json").unwrap();
    assert_eq!(manifest.files.len(), 2);
    let a_entry = manifest
        .files
        .iter()
        .find(|f| f.original_file_id == file_a)
        .unwrap()
        .audio_entry
        .clone();
    let b_entry = manifest
        .files
        .iter()
        .find(|f| f.original_file_id == file_b)
        .unwrap()
        .audio_entry
        .clone();
    assert_eq!(read_zip_bytes(&mut archive, &a_entry).unwrap(), b"audio-A");
    assert_eq!(read_zip_bytes(&mut archive, &b_entry).unwrap(), b"audio-B");
    let doc: ProjectBundleDocument = read_zip_json(&mut archive, "project.json").unwrap();
    let a_segs = doc
        .files
        .iter()
        .find(|f| f.original_file_id == file_a)
        .unwrap();
    let b_segs = doc
        .files
        .iter()
        .find(|f| f.original_file_id == file_b)
        .unwrap();
    assert_eq!(a_segs.segments[0].text, "A-from-db");
    assert_eq!(b_segs.segments[0].text, "B-only");

    let _ = fs::remove_dir_all(&st.root);
}

#[test]
fn export_and_import_includes_peaks_when_present() {
    let export_state = test_state("peaks_export");
    let project_id = "project-peaks";
    let seeded = seed_project(&export_state, project_id, "峰值项目", "audio.wav");
    let peaks_root = export_state
        .root
        .join("projects")
        .join(project_id)
        .join("peaks");
    fs::create_dir_all(&peaks_root).unwrap();
    fs::write(
        peaks_root.join(format!("{}_L0.dat", seeded.file_id)),
        b"peak-bytes",
    )
    .unwrap();
    fs::write(
        peaks_root.join(format!("{}.meta.json", seeded.file_id)),
        format!(
            r#"{{"sample_rate":16000,"duration_sec":1.0,"generated_levels":[0],"file_id":"{}"}}"#,
            seeded.file_id
        ),
    )
    .unwrap();

    let export_zip = export_state.root.join("with-peaks.zip");
    export_project_bundle_to_path(
        &export_state,
        project_id,
        &seeded.file_id,
        &export_zip,
        vec![SegmentDto {
            uid: None,
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: "p".into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
        }],
    )
    .unwrap();

    let mut archive = ZipArchive::new(File::open(&export_zip).unwrap()).unwrap();
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json").unwrap();
    let peaks_dir = manifest.files[0].peaks_dir.clone().expect("peaks_dir");
    let peak_entry = format!("{peaks_dir}/{}_L0.dat", seeded.file_id);
    assert_eq!(
        read_zip_bytes(&mut archive, &peak_entry).unwrap(),
        b"peak-bytes"
    );

    let import_state = test_state("peaks_import");
    let imported = import_project_bundle_from_path(&import_state, &export_zip).unwrap();
    let new_id = &imported.files[0].id;
    let imported_peak = import_state
        .root
        .join("projects")
        .join(&imported.id)
        .join("peaks")
        .join(format!("{new_id}_L0.dat"));
    assert_eq!(fs::read(&imported_peak).unwrap(), b"peak-bytes");

    let _ = fs::remove_dir_all(&export_state.root);
    let _ = fs::remove_dir_all(&import_state.root);
}

#[test]
fn export_skips_missing_keeps_orphan_absolute_and_siblings() {
    let st = test_state("export_orphan_sibling");
    let project_id = "project-orphan-export";
    let project_dir = st.root.join("projects").join(project_id);
    fs::create_dir_all(&project_dir).unwrap();
    let good = project_dir.join("good.wav");
    fs::write(&good, b"good-audio").unwrap();

    let orphan_root =
        std::env::temp_dir().join(format!("rushi_bundle_orphan_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&orphan_root).unwrap();
    let orphan = orphan_root.join("orphan.wav");
    fs::write(&orphan, b"orphan-audio").unwrap();
    let orphan_abs = orphan.canonicalize().unwrap().to_string_lossy().to_string();

    let conn = open_db(&st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, 1, 1)",
        params![project_id, "OrphanExport"],
    )
    .unwrap();
    let file_good = "file-good".to_string();
    let file_orphan = "file-orphan".to_string();
    let file_missing = "file-missing".to_string();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, 'good', 'paired', ?3, 1, 1)",
        params![&file_good, project_id, good.to_string_lossy().to_string()],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, 'orphan', 'paired', ?3, 2, 2)",
        params![&file_orphan, project_id, orphan_abs],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, 'missing', 'paired', ?3, 3, 3)",
        params![
            &file_missing,
            project_id,
            orphan_root.join("nope.wav").to_string_lossy().to_string()
        ],
    )
    .unwrap();
    drop(conn);

    let zip_path = st.root.join("orphan-export.zip");
    export_project_bundle_to_path(
        &st,
        project_id,
        &file_good,
        &zip_path,
        vec![SegmentDto {
            uid: None,
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: "g".into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
        }],
    )
    .unwrap();

    let mut archive = ZipArchive::new(File::open(&zip_path).unwrap()).unwrap();
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json").unwrap();
    let ids: Vec<&str> = manifest
        .files
        .iter()
        .map(|f| f.original_file_id.as_str())
        .collect();
    assert!(ids.contains(&file_good.as_str()));
    assert!(ids.contains(&file_orphan.as_str()));
    assert!(!ids.contains(&file_missing.as_str()));

    let _ = fs::remove_dir_all(&st.root);
    let _ = fs::remove_dir_all(&orphan_root);
}

#[test]
fn import_sorts_segments_by_idx_before_persist() {
    let st = test_state("import_sort_idx");
    let zip_path = st.root.join("unsorted.zip");
    let file = File::create(&zip_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let file_id = "f-unsorted".to_string();
    let manifest = ProjectBundleManifest {
        kind: PROJECT_BUNDLE_KIND.to_string(),
        version: PROJECT_BUNDLE_VERSION,
        exported_at_ms: 1,
        project: empty_project_meta("source-id", "原项目"),
        audio_file: None,
        files: vec![ProjectBundleFileManifest {
            original_file_id: file_id.clone(),
            name: "u".into(),
            file_type: "paired".into(),
            audio_entry: format!("audio/{file_id}.wav"),
            peaks_dir: None,
        }],
        includes_lexicon: false,
    };
    let doc = ProjectBundleDocument {
        name: "乱序".into(),
        created_at_ms: 2,
        updated_at_ms: 3,
        segments: vec![],
        files: vec![ProjectBundleFileDoc {
            original_file_id: file_id.clone(),
            name: "u".into(),
            file_type: "paired".into(),
            // Deliberately out of order vs array position.
            segments: vec![
                SegmentDto {
                    uid: None,
                    idx: 1,
                    start_sec: 1.0,
                    end_sec: 2.0,
                    text: "第二".into(),
                    confidence: None,
                    low_confidence: false,
                    detail: None,
                    kind: None,
                    text_stage: "auto_transcribe".to_string(),
                    finalize_via: None,
                    annotation: None,
                    frozen: false,
                },
                SegmentDto {
                    uid: None,
                    idx: 0,
                    start_sec: 0.0,
                    end_sec: 1.0,
                    text: "第一".into(),
                    confidence: None,
                    low_confidence: false,
                    detail: None,
                    kind: None,
                    text_stage: "auto_transcribe".to_string(),
                    finalize_via: None,
                    annotation: None,
                    frozen: false,
                },
            ],
        }],
        edit_log: vec![],
    };
    zip.start_file("manifest.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&manifest).unwrap())
        .unwrap();
    zip.start_file("project.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&doc).unwrap()).unwrap();
    zip.start_file(&format!("audio/{file_id}.wav"), zip_opts())
        .unwrap();
    zip.write_all(b"tiny").unwrap();
    zip.finish().unwrap();

    let imported = import_project_bundle_from_path(&st, &zip_path).unwrap();
    let conn = open_db(&st).unwrap();
    let texts: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT text FROM segments WHERE file_id = ?1 ORDER BY idx ASC",
            )
            .unwrap();
        stmt.query_map(params![&imported.files[0].id], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    };
    assert_eq!(texts, vec!["第一".to_string(), "第二".to_string()]);

    let _ = fs::remove_dir_all(&st.root);
}

#[test]
fn import_v1_project_bundle_still_works() {
    let st = test_state("import_v1");
    let zip_path = st.root.join("v1.zip");
    let file = File::create(&zip_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let manifest = ProjectBundleManifest {
        kind: PROJECT_BUNDLE_KIND.to_string(),
        version: PROJECT_BUNDLE_VERSION_V1,
        exported_at_ms: 1,
        project: empty_project_meta("source-id", "原项目"),
        audio_file: Some("audio.wav".into()),
        files: vec![],
        includes_lexicon: false,
    };
    let doc = ProjectBundleDocument {
        name: "导入项目".into(),
        created_at_ms: 2,
        updated_at_ms: 3,
        segments: vec![SegmentDto {
            uid: None,
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: "v1句".into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
        }],
        files: vec![],
        edit_log: vec![],
    };
    zip.start_file("manifest.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&manifest).unwrap())
        .unwrap();
    zip.start_file("project.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&doc).unwrap()).unwrap();
    zip.start_file("audio/audio.wav", zip_opts()).unwrap();
    zip.write_all(b"v1-audio").unwrap();
    zip.finish().unwrap();

    let imported = import_project_bundle_from_path(&st, &zip_path).unwrap();
    assert_eq!(imported.name, "导入项目");
    assert_eq!(imported.files.len(), 1);
    let conn = open_db(&st).unwrap();
    let text: String = conn
        .query_row(
            "SELECT text FROM segments WHERE file_id = ?1 AND idx = 0",
            params![&imported.files[0].id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(text, "v1句");

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
        project: empty_project_meta("source-id", "原项目"),
        audio_file: None,
        files: vec![ProjectBundleFileManifest {
            original_file_id: "f1".into(),
            name: "evil".into(),
            file_type: "paired".into(),
            audio_entry: "audio/../../evil.wav".into(),
            peaks_dir: None,
        }],
        includes_lexicon: false,
    };
    let doc = ProjectBundleDocument {
        name: "导入项目".into(),
        created_at_ms: 2,
        updated_at_ms: 3,
        segments: vec![],
        files: vec![ProjectBundleFileDoc {
            original_file_id: "f1".into(),
            name: "evil".into(),
            file_type: "paired".into(),
            segments: vec![],
        }],
        edit_log: vec![],
    };
    zip.start_file("manifest.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&manifest).unwrap())
        .unwrap();
    zip.start_file("project.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&doc).unwrap()).unwrap();
    zip.finish().unwrap();

    let err = import_project_bundle_from_path(&st, &zip_path)
        .unwrap_err()
        .to_string();
    assert!(err.contains("音频路径不安全"));

    let _ = fs::remove_dir_all(&st.root);
}

#[test]
fn import_project_bundle_rejects_zip_bomb_uncompressed_size() {
    let st = test_state("zip_bomb");
    let zip_path = st.root.join("bomb.zip");
    let file = File::create(&zip_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let manifest = ProjectBundleManifest {
        kind: PROJECT_BUNDLE_KIND.to_string(),
        version: PROJECT_BUNDLE_VERSION_V1,
        exported_at_ms: 1,
        project: empty_project_meta("source-id", "原项目"),
        audio_file: Some("audio.wav".into()),
        files: vec![],
        includes_lexicon: false,
    };
    let doc = ProjectBundleDocument {
        name: "导入项目".into(),
        created_at_ms: 2,
        updated_at_ms: 3,
        segments: vec![],
        files: vec![],
        edit_log: vec![],
    };
    zip.start_file("manifest.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&manifest).unwrap())
        .unwrap();
    zip.start_file("project.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&doc).unwrap()).unwrap();
    let oversized = vec![0u8; (MAX_BUNDLE_UNCOMPRESSED_BYTES + 1) as usize];
    zip.start_file("audio/audio.wav", zip_opts()).unwrap();
    zip.write_all(&oversized).unwrap();
    zip.finish().unwrap();

    let err = import_project_bundle_from_path(&st, &zip_path)
        .unwrap_err()
        .to_string();
    assert!(err.contains("解压体积过大") || err.contains("过大"));

    let _ = fs::remove_dir_all(&st.root);
}

#[test]
fn import_project_bundle_rejects_excessive_segment_count() {
    let st = test_state("too_many_segments");
    let zip_path = st.root.join("segments.zip");
    let file = File::create(&zip_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let manifest = ProjectBundleManifest {
        kind: PROJECT_BUNDLE_KIND.to_string(),
        version: PROJECT_BUNDLE_VERSION_V1,
        exported_at_ms: 1,
        project: empty_project_meta("source-id", "原项目"),
        audio_file: Some("audio.wav".into()),
        files: vec![],
        includes_lexicon: false,
    };
    let segments: Vec<SegmentDto> = (0..=MAX_BUNDLE_SEGMENT_COUNT)
        .map(|idx| SegmentDto {
            uid: None,
            idx: idx as i32,
            start_sec: idx as f64,
            end_sec: idx as f64 + 1.0,
            text: "x".into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
        })
        .collect();
    let doc = ProjectBundleDocument {
        name: "导入项目".into(),
        created_at_ms: 2,
        updated_at_ms: 3,
        segments,
        files: vec![],
        edit_log: vec![],
    };
    zip.start_file("manifest.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&manifest).unwrap())
        .unwrap();
    zip.start_file("project.json", zip_opts()).unwrap();
    zip.write_all(&serde_json::to_vec(&doc).unwrap()).unwrap();
    zip.start_file("audio/audio.wav", zip_opts()).unwrap();
    zip.write_all(b"tiny").unwrap();
    zip.finish().unwrap();

    let err = import_project_bundle_from_path(&st, &zip_path)
        .unwrap_err()
        .to_string();
    assert!(err.contains("语段数量超过上限"));

    let _ = fs::remove_dir_all(&st.root);
}

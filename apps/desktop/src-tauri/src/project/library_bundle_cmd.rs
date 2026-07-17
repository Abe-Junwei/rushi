//! Whole-library exchange zip: nested project bundles + one top-level lexicon.
//! Not a live SQLite snapshot (no models/secrets/prefs DB copy).

use crate::command_error::{CommandError, CommandResult};
use crate::DbState;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::lexicon_bundle::{
    build_lexicon_bundle_export, serialize_lexicon_bundle,
};
use super::project_bundle_cmd::{
    apply_embedded_lexicon, export_project_bundle_to_path, import_project_bundle_from_path,
    read_zip_bytes, read_zip_json, zip_opts, PROJECT_BUNDLE_LEXICON_ENTRY,
};
use super::types::{ProjectDetail, SegmentDto};
use super::utils::{now_ms, open_db};

pub(super) const LIBRARY_BUNDLE_KIND: &str = "rushi_library_bundle";
pub(super) const LIBRARY_BUNDLE_VERSION: u32 = 1;

#[cfg(test)]
const MAX_LIBRARY_UNCOMPRESSED_BYTES: u64 = 512 * 1024;
#[cfg(not(test))]
const MAX_LIBRARY_UNCOMPRESSED_BYTES: u64 = 8 * 1024 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
struct LibraryBundleManifest {
    kind: String,
    version: u32,
    exported_at_ms: i64,
    projects: Vec<LibraryBundleProjectEntry>,
    #[serde(default)]
    includes_lexicon: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    skipped_project_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LibraryBundleProjectEntry {
    original_id: String,
    name: String,
    entry: String,
}

fn validate_library_archive(archive: &mut ZipArchive<File>) -> CommandResult<()> {
    let mut total: u64 = 0;
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(CommandError::BundleZipEntry)?;
        if file.is_dir() {
            continue;
        }
        let name = file.name();
        if name.contains("..") || name.starts_with('/') || name.starts_with('\\') {
            return Err(CommandError::BundleUnsafeZipPath);
        }
        total = total.saturating_add(file.size());
        if total > MAX_LIBRARY_UNCOMPRESSED_BYTES {
            return Err(CommandError::BundleUncompressedTooLarge {
                limit: MAX_LIBRARY_UNCOMPRESSED_BYTES,
            });
        }
    }
    Ok(())
}

/// Export all projects as nested v2 zips + one top-level lexicon.json.
pub(super) fn export_library_bundle_to_path(
    st: &DbState,
    zip_path: &Path,
    override_project_id: Option<&str>,
    override_file_id: Option<&str>,
    override_segments: Vec<SegmentDto>,
) -> CommandResult<String> {
    if zip_path.exists() {
        return Err(CommandError::TargetFileExists);
    }

    let conn = open_db(st).map_err(CommandError::db_pool)?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM projects ORDER BY updated_at_ms DESC, id ASC")
        .map_err(CommandError::from)?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(CommandError::from)?;
    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(CommandError::from)?);
    }
    drop(stmt);
    drop(conn);

    if projects.is_empty() {
        return Err(CommandError::ExportProjectBundle {
            detail: "内容库中没有可导出的项目。".into(),
        });
    }

    let staging = zip_path.with_extension("library-staging");
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(CommandError::BundleCreateProjectDir)?;

    let mut packed = Vec::new();
    let mut skipped = Vec::new();

    for (project_id, name) in &projects {
        let nested = staging.join(format!("{project_id}.zip"));
        let (file_id, segs) = if override_project_id == Some(project_id.as_str()) {
            (
                override_file_id.unwrap_or("").to_string(),
                override_segments.clone(),
            )
        } else {
            (String::new(), Vec::new())
        };
        match export_project_bundle_to_path(st, project_id, &file_id, &nested, segs, false) {
            Ok(_) => {
                packed.push(LibraryBundleProjectEntry {
                    original_id: project_id.clone(),
                    name: name.clone(),
                    entry: format!("projects/{project_id}.zip"),
                });
            }
            Err(CommandError::BundleNoExportableAudio) => {
                skipped.push(project_id.clone());
            }
            Err(_) => {
                skipped.push(project_id.clone());
            }
        }
    }

    if packed.is_empty() {
        let _ = fs::remove_dir_all(&staging);
        return Err(CommandError::BundleNoExportableAudio);
    }

    let lexicon_json = {
        let conn = open_db(st).map_err(CommandError::db_pool)?;
        let doc = build_lexicon_bundle_export(&conn, true, Some("library-bundle".into()))
            .map_err(|detail| CommandError::ExportProjectBundle { detail })?;
        serialize_lexicon_bundle(&doc)
            .map_err(|detail| CommandError::ExportProjectBundle { detail })?
    };

    let tmp_path = zip_path.with_extension("zip.part");
    let out = File::create(&tmp_path).map_err(CommandError::BundleCreate)?;
    let mut zip = ZipWriter::new(out);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    for entry in &packed {
        let nested_path = staging.join(format!("{}.zip", entry.original_id));
        let bytes = fs::read(&nested_path).map_err(CommandError::BundleReadAudio)?;
        zip.start_file(&entry.entry, opts)
            .map_err(CommandError::BundleFinish)?;
        zip.write_all(&bytes)
            .map_err(|e| CommandError::io("写入整库嵌套项目包", e))?;
    }

    let manifest = LibraryBundleManifest {
        kind: LIBRARY_BUNDLE_KIND.to_string(),
        version: LIBRARY_BUNDLE_VERSION,
        exported_at_ms: now_ms(),
        projects: packed,
        includes_lexicon: true,
        skipped_project_ids: skipped,
    };
    zip.start_file("manifest.json", zip_opts())
        .map_err(CommandError::BundleFinish)?;
    zip.write_all(
        &serde_json::to_vec_pretty(&manifest).map_err(CommandError::BundleSerializeManifest)?,
    )
    .map_err(|e| CommandError::io("写入整库 manifest", e))?;

    zip.start_file(PROJECT_BUNDLE_LEXICON_ENTRY, zip_opts())
        .map_err(CommandError::BundleFinish)?;
    zip.write_all(lexicon_json.as_bytes())
        .map_err(|e| CommandError::io("写入整库 lexicon.json", e))?;

    if let Err(e) = zip.finish().map_err(CommandError::BundleFinish) {
        let _ = fs::remove_file(&tmp_path);
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }
    let _ = fs::remove_dir_all(&staging);
    if let Err(e) = fs::rename(&tmp_path, zip_path).map_err(CommandError::BundleSave) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }
    Ok(zip_path.to_string_lossy().to_string())
}

/// Import library zip: nested project bundles + top-level lexicon once.
/// Returns the last successfully imported project detail (for FE focus).
pub(super) fn import_library_bundle_from_path(
    st: &DbState,
    zip_path: &Path,
) -> CommandResult<ProjectDetail> {
    let file = File::open(zip_path).map_err(CommandError::BundleOpen)?;
    let mut archive = ZipArchive::new(file).map_err(CommandError::BundleRead)?;
    validate_library_archive(&mut archive)?;
    let manifest: LibraryBundleManifest = read_zip_json(&mut archive, "manifest.json")?;
    if manifest.kind != LIBRARY_BUNDLE_KIND {
        return Err(CommandError::BundleUnsupportedKind);
    }
    if manifest.version != LIBRARY_BUNDLE_VERSION {
        return Err(CommandError::BundleUnsupportedVersion {
            found: manifest.version,
            supported: LIBRARY_BUNDLE_VERSION,
        });
    }
    if manifest.projects.is_empty() {
        return Err(CommandError::BundleNoExportableAudio);
    }

    let staging = zip_path.with_extension("library-import-staging");
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(CommandError::BundleCreateProjectDir)?;

    let mut last: Option<ProjectDetail> = None;
    let mut failures = Vec::new();

    for entry in &manifest.projects {
        if entry.entry.contains("..") || !entry.entry.starts_with("projects/") {
            failures.push(entry.original_id.clone());
            continue;
        }
        let bytes = match read_zip_bytes(&mut archive, &entry.entry) {
            Ok(b) => b,
            Err(_) => {
                failures.push(entry.original_id.clone());
                continue;
            }
        };
        // Nested zip must be a project bundle (not another library).
        let nested_path = staging.join(format!("{}.zip", entry.original_id));
        if fs::write(&nested_path, &bytes).is_err() {
            failures.push(entry.original_id.clone());
            continue;
        }
        match import_project_bundle_from_path(st, &nested_path) {
            Ok(detail) => last = Some(detail),
            Err(_) => failures.push(entry.original_id.clone()),
        }
    }

    if let Ok(lex_bytes) = read_zip_bytes(&mut archive, PROJECT_BUNDLE_LEXICON_ENTRY) {
        let _ = apply_embedded_lexicon(st, &lex_bytes);
    }

    let _ = fs::remove_dir_all(&staging);

    let Some(detail) = last else {
        return Err(CommandError::ImportProjectBundle {
            detail: format!(
                "整库包未能导入任何项目（失败 {} 个）。",
                failures.len()
            ),
        });
    };
    Ok(detail)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::project_bundle_cmd::PROJECT_BUNDLE_KIND;
    use crate::project::utils::open_db;
    use rusqlite::params;
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    fn test_state(label: &str) -> DbState {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi_lib_bundle_{label}_{unique}"));
        fs::create_dir_all(&root).unwrap();
        DbState::open_test_db(root)
    }

    fn seed_project(st: &DbState, project_id: &str, name: &str, audio_leaf: &str, bytes: &[u8]) {
        let project_dir = st.root.join("projects").join(project_id);
        fs::create_dir_all(&project_dir).unwrap();
        let audio_path = project_dir.join(audio_leaf);
        fs::write(&audio_path, bytes).unwrap();
        let conn = open_db(st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, 1, 1)",
            params![project_id, name],
        )
        .unwrap();
        let file_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, 'paired', ?4, 1, 1)",
            params![
                file_id,
                project_id,
                name,
                audio_path.to_string_lossy().to_string()
            ],
        )
        .unwrap();
    }

    #[test]
    fn library_bundle_round_trip_two_projects_and_lexicon() {
        let export_st = test_state("lib_export");
        seed_project(&export_st, "p1", "项目一", "a.wav", b"aa");
        seed_project(&export_st, "p2", "项目二", "b.wav", b"bb");
        {
            let conn = open_db(&export_st).unwrap();
            conn.execute(
                "INSERT INTO glossary_terms (term, aliases, domain, note, created_at_ms, updated_at_ms, hotword_enabled) \
                 VALUES ('整库词', '', '', '', 1, 1, 1)",
                [],
            )
            .unwrap();
        }

        let zip = export_st.root.join("library.zip");
        export_library_bundle_to_path(&export_st, &zip, None, None, vec![]).unwrap();

        let mut archive = ZipArchive::new(File::open(&zip).unwrap()).unwrap();
        let manifest: LibraryBundleManifest =
            read_zip_json(&mut archive, "manifest.json").unwrap();
        assert_eq!(manifest.kind, LIBRARY_BUNDLE_KIND);
        assert_eq!(manifest.projects.len(), 2);
        assert!(manifest.includes_lexicon);
        let nested = read_zip_bytes(&mut archive, &manifest.projects[0].entry).unwrap();
        // Nested must not re-embed lexicon (size check via inner zip kind only).
        let nested_path = export_st.root.join("nested-check.zip");
        fs::write(&nested_path, &nested).unwrap();
        let mut nested_zip = ZipArchive::new(File::open(&nested_path).unwrap()).unwrap();
        let nested_manifest: serde_json::Value =
            read_zip_json(&mut nested_zip, "manifest.json").unwrap();
        assert_eq!(nested_manifest["kind"], PROJECT_BUNDLE_KIND);
        assert_eq!(nested_manifest["includes_lexicon"], false);
        assert!(nested_zip.by_name(PROJECT_BUNDLE_LEXICON_ENTRY).is_err());

        let import_st = test_state("lib_import");
        let last = import_library_bundle_from_path(&import_st, &zip).unwrap();
        assert!(!last.id.is_empty());
        let conn = open_db(&import_st).unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 2);
        let terms: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM glossary_terms WHERE term = '整库词'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(terms, 1);

        let _ = fs::remove_dir_all(&export_st.root);
        let _ = fs::remove_dir_all(&import_st.root);
    }
}

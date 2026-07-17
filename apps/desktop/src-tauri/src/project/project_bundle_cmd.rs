//! Project exchange zip (self-contained for offline handoff; not a live DB sync).
//!
//! - **v1**: single audio + segments (legacy import kept).
//! - **v2**: all project files + segments + peaks (best-effort) + project metadata +
//!   edit_log + embedded global lexicon (`lexicon.json`, glossary + stable correction rules).

use crate::command_error::{CommandError, CommandResult};
use crate::media_base_dir::{audio_project_dir, persist_audio_storage_path, resolve_audio_path};
use crate::project::waveform_peaks::{
    peak_file_path, peak_meta_path, peaks_dir, PEAK_LEVELS,
};
use crate::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::lexicon_bundle::{
    apply_lexicon_bundle_import, build_lexicon_bundle_export, parse_lexicon_bundle_json,
    preview_lexicon_bundle_import, serialize_lexicon_bundle, LexiconBundleConflictResolution,
};
use super::segment_uid::segment_uid_or_new;
use super::types::{ProjectDetail, SegmentDto};
use super::utils::{now_ms, open_db, project_detail_from_conn};

pub(super) const PROJECT_BUNDLE_LEXICON_ENTRY: &str = "lexicon.json";

pub(super) const PROJECT_BUNDLE_KIND: &str = "rushi_project_bundle";
/// v2 = self-contained multi-file + peaks + metadata + edit_log.
pub(super) const PROJECT_BUNDLE_VERSION: u32 = 2;
pub(super) const PROJECT_BUNDLE_VERSION_V1: u32 = 1;
#[cfg(test)]
pub(super) const MAX_BUNDLE_UNCOMPRESSED_BYTES: u64 = 16 * 1024;
#[cfg(not(test))]
pub(super) const MAX_BUNDLE_UNCOMPRESSED_BYTES: u64 = 500 * 1024 * 1024;
#[cfg(test)]
pub(super) const MAX_BUNDLE_SEGMENT_COUNT: usize = 10;
#[cfg(not(test))]
pub(super) const MAX_BUNDLE_SEGMENT_COUNT: usize = 100_000;

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleManifest {
    pub(super) kind: String,
    pub(super) version: u32,
    pub(super) exported_at_ms: i64,
    pub(super) project: ProjectBundleProjectMeta,
    /// v1 only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) audio_file: Option<String>,
    /// v2 file index.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(super) files: Vec<ProjectBundleFileManifest>,
    /// v2: zip contains `lexicon.json` (global glossary + stable correction rules).
    #[serde(default)]
    pub(super) includes_lexicon: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleProjectMeta {
    pub(super) original_id: String,
    pub(super) name: String,
    pub(super) created_at_ms: i64,
    pub(super) updated_at_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) narrator: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) recorded_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) transcriber: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleFileManifest {
    pub(super) original_file_id: String,
    pub(super) name: String,
    pub(super) file_type: String,
    pub(super) audio_entry: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) peaks_dir: Option<String>,
}

/// v1 document (top-level segments).
#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleDocument {
    pub(super) name: String,
    pub(super) created_at_ms: i64,
    pub(super) updated_at_ms: i64,
    #[serde(default)]
    pub(super) segments: Vec<SegmentDto>,
    #[serde(default)]
    pub(super) files: Vec<ProjectBundleFileDoc>,
    #[serde(default)]
    pub(super) edit_log: Vec<ProjectBundleEditLogEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleFileDoc {
    pub(super) original_file_id: String,
    pub(super) name: String,
    pub(super) file_type: String,
    pub(super) segments: Vec<SegmentDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct ProjectBundleEditLogEntry {
    pub(super) at_ms: i64,
    pub(super) kind: String,
    pub(super) detail: String,
}

pub(super) fn zip_opts() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

pub(super) fn read_zip_bytes(archive: &mut ZipArchive<File>, name: &str) -> CommandResult<Vec<u8>> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| CommandError::BundleMissingEntry {
            name: name.to_string(),
            detail: e.to_string(),
        })?;
    let size = file.size();
    if size > MAX_BUNDLE_UNCOMPRESSED_BYTES {
        return Err(CommandError::BundleEntryTooLarge {
            name: name.to_string(),
            limit: MAX_BUNDLE_UNCOMPRESSED_BYTES,
        });
    }
    let mut out = Vec::with_capacity(size.min(64 * 1024) as usize);
    file.read_to_end(&mut out)
        .map_err(|e| CommandError::BundleReadEntry {
            name: name.to_string(),
            source: e,
        })?;
    Ok(out)
}

fn validate_bundle_archive(archive: &mut ZipArchive<File>) -> CommandResult<()> {
    let mut total_uncompressed: u64 = 0;
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(CommandError::BundleZipEntry)?;
        if file.is_dir() {
            continue;
        }
        let name = file.name();
        if name.contains("..") || name.starts_with('/') || name.starts_with('\\') {
            return Err(CommandError::BundleUnsafeZipPath);
        }
        total_uncompressed = total_uncompressed.saturating_add(file.size());
        if total_uncompressed > MAX_BUNDLE_UNCOMPRESSED_BYTES {
            return Err(CommandError::BundleUncompressedTooLarge {
                limit: MAX_BUNDLE_UNCOMPRESSED_BYTES,
            });
        }
    }
    Ok(())
}

pub(super) fn read_zip_json<T: for<'de> Deserialize<'de>>(
    archive: &mut ZipArchive<File>,
    name: &str,
) -> CommandResult<T> {
    let bytes = read_zip_bytes(archive, name)?;
    serde_json::from_slice(&bytes).map_err(|e| CommandError::BundleJsonParse {
        name: name.to_string(),
        source: e,
    })
}

fn opt_nonempty(s: Option<String>) -> Option<String> {
    s.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

fn load_segments_from_db(st: &DbState, file_id: &str) -> CommandResult<Vec<SegmentDto>> {
    let conn = open_db(st).map_err(CommandError::db_pool)?;
    let mut stmt = conn
        .prepare(
            "SELECT uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail, kind, \
             text_stage, finalize_via, annotation, frozen \
             FROM segments WHERE file_id = ?1 ORDER BY idx ASC",
        )
        .map_err(CommandError::from)?;
    let rows = stmt
        .query_map(params![file_id], |r| {
            let uid: String = r.get(0)?;
            let detail: String = r.get(7)?;
            let kind: Option<String> = r.get(8)?;
            let text_stage: String = r.get(9)?;
            let finalize_via: Option<String> = r.get(10)?;
            let annotation: String = r.get(11)?;
            let frozen: i64 = r.get(12)?;
            Ok(SegmentDto {
                uid: if uid.trim().is_empty() {
                    None
                } else {
                    Some(uid)
                },
                idx: r.get(1)?,
                start_sec: r.get(2)?,
                end_sec: r.get(3)?,
                text: r.get(4)?,
                confidence: r.get(5)?,
                low_confidence: r.get::<_, i64>(6)? != 0,
                detail: if detail.is_empty() {
                    None
                } else {
                    Some(detail)
                },
                kind: kind.filter(|s| !s.trim().is_empty()),
                text_stage: if text_stage.trim().is_empty() {
                    "auto_transcribe".to_string()
                } else {
                    text_stage
                },
                finalize_via: finalize_via.filter(|s| !s.trim().is_empty()),
                annotation: if annotation.trim().is_empty() {
                    None
                } else {
                    Some(annotation)
                },
                frozen: frozen != 0,
            })
        })
        .map_err(CommandError::from)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(CommandError::from)?);
    }
    Ok(out)
}

fn load_edit_log(st: &DbState, project_id: &str) -> CommandResult<Vec<ProjectBundleEditLogEntry>> {
    let conn = open_db(st).map_err(CommandError::db_pool)?;
    let mut stmt = conn
        .prepare(
            "SELECT at_ms, kind, detail FROM edit_log WHERE project_id = ?1 ORDER BY id ASC",
        )
        .map_err(CommandError::from)?;
    let rows = stmt
        .query_map(params![project_id], |r| {
            Ok(ProjectBundleEditLogEntry {
                at_ms: r.get(0)?,
                kind: r.get(1)?,
                detail: r.get(2)?,
            })
        })
        .map_err(CommandError::from)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(CommandError::from)?);
    }
    Ok(out)
}

fn write_peaks_into_zip(
    zip: &mut ZipWriter<File>,
    peaks_root: &Path,
    file_id: &str,
    zip_prefix: &str,
) -> CommandResult<bool> {
    let mut any = false;
    for (level, _) in PEAK_LEVELS {
        let from = peak_file_path(peaks_root, file_id, level);
        if !from.is_file() {
            continue;
        }
        let bytes = fs::read(&from).map_err(CommandError::BundleReadAudio)?;
        let entry = format!("{zip_prefix}/{file_id}_L{level}.dat");
        zip.start_file(&entry, zip_opts())
            .map_err(CommandError::BundleFinish)?;
        zip.write_all(&bytes)
            .map_err(|e| CommandError::io("写入 peaks", e))?;
        any = true;
    }
    let meta = peak_meta_path(peaks_root, file_id);
    if meta.is_file() {
        let bytes = fs::read(&meta).map_err(CommandError::BundleReadAudio)?;
        let entry = format!("{zip_prefix}/{file_id}.meta.json");
        zip.start_file(&entry, zip_opts())
            .map_err(CommandError::BundleFinish)?;
        zip.write_all(&bytes)
            .map_err(|e| CommandError::io("写入 peaks meta", e))?;
        any = true;
    }
    Ok(any)
}

fn extract_peaks_from_zip(
    archive: &mut ZipArchive<File>,
    zip_prefix: &str,
    old_file_id: &str,
    new_peaks_root: &Path,
    new_file_id: &str,
) -> CommandResult<()> {
    fs::create_dir_all(new_peaks_root).map_err(CommandError::BundleCreateProjectDir)?;
    for (level, _) in PEAK_LEVELS {
        let entry = format!("{zip_prefix}/{old_file_id}_L{level}.dat");
        if archive.by_name(&entry).is_err() {
            continue;
        }
        let bytes = read_zip_bytes(archive, &entry)?;
        let dest = peak_file_path(new_peaks_root, new_file_id, level);
        fs::write(&dest, bytes).map_err(CommandError::BundleWriteAudio)?;
    }
    let meta_entry = format!("{zip_prefix}/{old_file_id}.meta.json");
    if archive.by_name(&meta_entry).is_ok() {
        let bytes = read_zip_bytes(archive, &meta_entry)?;
        // Rewrite file_id inside meta if present — best-effort string replace.
        let text = String::from_utf8_lossy(&bytes).replace(old_file_id, new_file_id);
        fs::write(peak_meta_path(new_peaks_root, new_file_id), text.as_bytes())
            .map_err(CommandError::BundleWriteAudio)?;
    }
    Ok(())
}

fn insert_segments(
    tx: &rusqlite::Transaction<'_>,
    file_id: &str,
    segments: &[SegmentDto],
) -> CommandResult<()> {
    let mut ordered: Vec<&SegmentDto> = segments.iter().collect();
    ordered.sort_by_key(|s| s.idx);
    for (idx, s) in ordered.into_iter().enumerate() {
        let uid = segment_uid_or_new(&s.uid);
        let low = if s.low_confidence { 1i64 } else { 0i64 };
        let detail = s.detail.as_deref().unwrap_or("");
        let kind = s.kind.as_deref().filter(|k| !k.trim().is_empty());
        let text_stage = if s.text_stage.trim().is_empty() {
            "auto_transcribe"
        } else {
            s.text_stage.as_str()
        };
        let finalize_via = s.finalize_via.as_deref().filter(|v| !v.trim().is_empty());
        let annotation = s.annotation.as_deref().unwrap_or("").trim();
        let frozen = if s.frozen { 1i64 } else { 0i64 };
        tx.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail, kind, text_stage, finalize_via, annotation, frozen) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                file_id,
                uid.as_str(),
                idx as i32,
                s.start_sec,
                s.end_sec,
                s.text.as_str(),
                s.confidence,
                low,
                detail,
                kind,
                text_stage,
                finalize_via,
                annotation,
                frozen,
            ],
        )
        .map_err(CommandError::from)?;
    }
    Ok(())
}

/// Export resolve: scoped first, then adopt orphan absolute on disk (same as relocate).
fn resolve_audio_for_export(st: &DbState, audio_storage: &str) -> Result<PathBuf, String> {
    match resolve_audio_path(st, audio_storage) {
        Ok(p) => Ok(p),
        Err(scoped_err) => crate::media_base_dir::resolve_absolute_existing_for_relocate(
            audio_storage,
        )
        .map_err(|adopt_err| format!("{scoped_err}；{adopt_err}")),
    }
}

/// Export full project as self-contained v2 zip.
/// `primary_file_id` + `primary_segments` override DB segments for the currently open file
/// (after frontend draft flush).
pub(super) fn export_project_bundle_to_path(
    st: &DbState,
    project_id: &str,
    primary_file_id: &str,
    zip_path: &Path,
    primary_segments: Vec<SegmentDto>,
) -> CommandResult<String> {
    if zip_path.exists() {
        return Err(CommandError::TargetFileExists);
    }

    let conn = open_db(st).map_err(CommandError::db_pool)?;
    let (name, created_at_ms, updated_at_ms, narrator, recorded_at, location, subject, transcriber): (
        String,
        i64,
        i64,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ) = conn
        .query_row(
            "SELECT name, created_at_ms, updated_at_ms, narrator, recorded_at, location, subject, transcriber \
             FROM projects WHERE id = ?1",
            params![project_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                ))
            },
        )
        .map_err(CommandError::from)?;

    let mut file_stmt = conn
        .prepare(
            "SELECT id, name, file_type, audio_path FROM files \
             WHERE project_id = ?1 AND audio_path IS NOT NULL AND TRIM(audio_path) != '' \
             ORDER BY created_at_ms ASC, id ASC",
        )
        .map_err(CommandError::from)?;
    let file_rows = file_stmt
        .query_map(params![project_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(CommandError::from)?;
    let mut files_raw = Vec::new();
    for row in file_rows {
        files_raw.push(row.map_err(CommandError::from)?);
    }
    drop(file_stmt);
    drop(conn);

    if files_raw.is_empty() {
        return Err(CommandError::BundleNoExportableAudio);
    }

    let edit_log = load_edit_log(st, project_id)?;

    let lexicon_json = {
        let conn = open_db(st).map_err(CommandError::db_pool)?;
        // stable_only: same default as standalone lexicon export (skip noisy hit=1 drafts).
        let doc = build_lexicon_bundle_export(&conn, true, Some("project-bundle".into()))
            .map_err(|detail| CommandError::ExportProjectBundle { detail })?;
        serialize_lexicon_bundle(&doc)
            .map_err(|detail| CommandError::ExportProjectBundle { detail })?
    };

    let tmp_path = zip_path.with_extension("zip.part");
    let file = File::create(&tmp_path).map_err(CommandError::BundleCreate)?;
    let mut zip = ZipWriter::new(file);

    let mut manifest_files = Vec::new();
    let mut doc_files = Vec::new();
    let mut total_segments = 0usize;

    for (file_id, file_name, file_type, audio_storage) in &files_raw {
        let Ok(resolved) = resolve_audio_for_export(st, audio_storage) else {
            // One missing/unreadable orphan must not abort the rest of a multi-file pack.
            continue;
        };
        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("dat")
            .to_ascii_lowercase();
        let audio_entry = format!("audio/{file_id}.{ext}");
        let audio_bytes = match fs::read(&resolved) {
            Ok(b) => b,
            Err(_) => continue,
        };
        zip.start_file(&audio_entry, zip_opts())
            .map_err(CommandError::BundleFinish)?;
        zip.write_all(&audio_bytes)
            .map_err(|e| CommandError::io("写入项目包音频", e))?;

        let peaks_zip_prefix = format!("peaks/{file_id}");
        let media_proj = crate::media_base_dir::media_project_dir(st, project_id)
            .unwrap_or_else(|_| st.root.join("projects").join(project_id));
        let peaks_root = peaks_dir(&media_proj);
        let legacy_peaks = peaks_dir(&st.root.join("projects").join(project_id));
        let mut peaks_packed = write_peaks_into_zip(&mut zip, &peaks_root, file_id, &peaks_zip_prefix)?;
        if !peaks_packed && legacy_peaks != peaks_root {
            peaks_packed =
                write_peaks_into_zip(&mut zip, &legacy_peaks, file_id, &peaks_zip_prefix)?;
        }

        let segments = if file_id == primary_file_id {
            primary_segments.clone()
        } else {
            load_segments_from_db(st, file_id)?
        };
        total_segments = total_segments.saturating_add(segments.len());
        if total_segments > MAX_BUNDLE_SEGMENT_COUNT {
            let _ = fs::remove_file(&tmp_path);
            return Err(CommandError::BundleTooManySegments {
                limit: MAX_BUNDLE_SEGMENT_COUNT,
            });
        }

        manifest_files.push(ProjectBundleFileManifest {
            original_file_id: file_id.clone(),
            name: file_name.clone(),
            file_type: file_type.clone(),
            audio_entry: audio_entry.clone(),
            peaks_dir: peaks_packed.then(|| peaks_zip_prefix.clone()),
        });
        doc_files.push(ProjectBundleFileDoc {
            original_file_id: file_id.clone(),
            name: file_name.clone(),
            file_type: file_type.clone(),
            segments,
        });
    }

    if manifest_files.is_empty() {
        let _ = fs::remove_file(&tmp_path);
        return Err(CommandError::BundleNoExportableAudio);
    }

    let manifest = ProjectBundleManifest {
        kind: PROJECT_BUNDLE_KIND.to_string(),
        version: PROJECT_BUNDLE_VERSION,
        exported_at_ms: now_ms(),
        project: ProjectBundleProjectMeta {
            original_id: project_id.to_string(),
            name: name.clone(),
            created_at_ms,
            updated_at_ms,
            narrator: opt_nonempty(narrator),
            recorded_at: opt_nonempty(recorded_at),
            location: opt_nonempty(location),
            subject: opt_nonempty(subject),
            transcriber: opt_nonempty(transcriber),
        },
        audio_file: None,
        files: manifest_files,
        includes_lexicon: true,
    };
    let doc = ProjectBundleDocument {
        name: name.clone(),
        created_at_ms,
        updated_at_ms,
        segments: Vec::new(),
        files: doc_files,
        edit_log,
    };

    zip.start_file("manifest.json", zip_opts())
        .map_err(CommandError::BundleFinish)?;
    zip.write_all(
        &serde_json::to_vec_pretty(&manifest).map_err(CommandError::BundleSerializeManifest)?,
    )
    .map_err(|e| CommandError::io("写入 manifest", e))?;

    zip.start_file("project.json", zip_opts())
        .map_err(CommandError::BundleFinish)?;
    zip.write_all(&serde_json::to_vec_pretty(&doc).map_err(CommandError::BundleSerializeProject)?)
        .map_err(|e| CommandError::io("写入 project.json", e))?;

    zip.start_file(PROJECT_BUNDLE_LEXICON_ENTRY, zip_opts())
        .map_err(CommandError::BundleFinish)?;
    zip.write_all(lexicon_json.as_bytes())
        .map_err(|e| CommandError::io("写入 lexicon.json", e))?;

    if let Err(e) = zip.finish().map_err(CommandError::BundleFinish) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }
    if let Err(e) = fs::rename(&tmp_path, zip_path).map_err(CommandError::BundleSave) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }
    Ok(zip_path.to_string_lossy().to_string())
}

pub(super) fn import_project_bundle_from_path(
    st: &DbState,
    zip_path: &Path,
) -> CommandResult<ProjectDetail> {
    let file = File::open(zip_path).map_err(CommandError::BundleOpen)?;
    let mut archive = ZipArchive::new(file).map_err(CommandError::BundleRead)?;
    validate_bundle_archive(&mut archive)?;
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json")?;
    if manifest.kind != PROJECT_BUNDLE_KIND {
        return Err(CommandError::BundleUnsupportedKind);
    }
    match manifest.version {
        PROJECT_BUNDLE_VERSION_V1 => import_v1(st, zip_path, &mut archive, manifest),
        PROJECT_BUNDLE_VERSION => import_v2(st, zip_path, &mut archive, manifest),
        found => Err(CommandError::BundleUnsupportedVersion {
            found,
            supported: PROJECT_BUNDLE_VERSION,
        }),
    }
}

fn import_v1(
    st: &DbState,
    zip_path: &Path,
    archive: &mut ZipArchive<File>,
    manifest: ProjectBundleManifest,
) -> CommandResult<ProjectDetail> {
    let audio_file = manifest
        .audio_file
        .as_deref()
        .ok_or(CommandError::BundleInvalidAudioName)?;
    let Some(audio_file_name) = Path::new(audio_file).file_name().and_then(|n| n.to_str()) else {
        return Err(CommandError::BundleInvalidAudioName);
    };
    if audio_file_name != audio_file {
        return Err(CommandError::BundleUnsafeAudioPath);
    }

    let doc: ProjectBundleDocument = read_zip_json(archive, "project.json")?;
    if doc.segments.len() > MAX_BUNDLE_SEGMENT_COUNT {
        return Err(CommandError::BundleTooManySegments {
            limit: MAX_BUNDLE_SEGMENT_COUNT,
        });
    }
    let audio_bytes = read_zip_bytes(archive, &format!("audio/{audio_file_name}"))?;
    import_project_from_parts(
        st,
        zip_path,
        &manifest,
        &doc.name,
        doc.created_at_ms,
        &[(
            "legacy".to_string(),
            doc.name.clone(),
            "paired".to_string(),
            audio_file_name.to_string(),
            audio_bytes,
            doc.segments,
            None,
        )],
        &[],
        archive,
    )
}

fn import_v2(
    st: &DbState,
    zip_path: &Path,
    archive: &mut ZipArchive<File>,
    manifest: ProjectBundleManifest,
) -> CommandResult<ProjectDetail> {
    if manifest.files.is_empty() {
        return Err(CommandError::BundleNoExportableAudio);
    }
    let doc: ProjectBundleDocument = read_zip_json(archive, "project.json")?;
    let mut segs_by_id: std::collections::HashMap<String, Vec<SegmentDto>> = doc
        .files
        .into_iter()
        .map(|f| (f.original_file_id, f.segments))
        .collect();

    let mut total_segs = 0usize;
    let mut packed = Vec::new();
    for f in &manifest.files {
        let Some(audio_name) = Path::new(&f.audio_entry)
            .file_name()
            .and_then(|n| n.to_str())
        else {
            return Err(CommandError::BundleInvalidAudioName);
        };
        if f.audio_entry.contains("..") || !f.audio_entry.starts_with("audio/") {
            return Err(CommandError::BundleUnsafeAudioPath);
        }
        let audio_bytes = read_zip_bytes(archive, &f.audio_entry)?;
        let segments = segs_by_id.remove(&f.original_file_id).unwrap_or_default();
        total_segs = total_segs.saturating_add(segments.len());
        if total_segs > MAX_BUNDLE_SEGMENT_COUNT {
            return Err(CommandError::BundleTooManySegments {
                limit: MAX_BUNDLE_SEGMENT_COUNT,
            });
        }
        packed.push((
            f.original_file_id.clone(),
            f.name.clone(),
            f.file_type.clone(),
            audio_name.to_string(),
            audio_bytes,
            segments,
            f.peaks_dir.clone(),
        ));
    }

    import_project_from_parts(
        st,
        zip_path,
        &manifest,
        &doc.name,
        doc.created_at_ms,
        &packed,
        &doc.edit_log,
        archive,
    )
}

#[allow(clippy::type_complexity)]
fn import_project_from_parts(
    st: &DbState,
    zip_path: &Path,
    manifest: &ProjectBundleManifest,
    doc_name: &str,
    doc_created_at_ms: i64,
    files: &[(
        String,
        String,
        String,
        String,
        Vec<u8>,
        Vec<SegmentDto>,
        Option<String>,
    )],
    edit_log: &[ProjectBundleEditLogEntry],
    archive: &mut ZipArchive<File>,
) -> CommandResult<ProjectDetail> {
    let id = Uuid::new_v4().to_string();
    let media_base = resolve_audio_path_media_base(st)?;
    let dest_proj = audio_project_dir(&media_base, &id);
    fs::create_dir_all(&dest_proj).map_err(CommandError::BundleCreateProjectDir)?;
    let peaks_root = peaks_dir(&dest_proj);

    let imported_name = if doc_name.trim().is_empty() {
        manifest.project.name.trim()
    } else {
        doc_name.trim()
    };
    let now = now_ms();
    let created_at_ms = if doc_created_at_ms > 0 {
        doc_created_at_ms
    } else {
        now
    };

    let db_result = (|| -> CommandResult<()> {
        let mut conn = open_db(st).map_err(CommandError::db_pool)?;
        let tx = conn.transaction().map_err(CommandError::from)?;
        tx.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms, narrator, recorded_at, location, subject, transcriber) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &id,
                imported_name,
                created_at_ms,
                now,
                manifest.project.narrator.as_deref(),
                manifest.project.recorded_at.as_deref(),
                manifest.project.location.as_deref(),
                manifest.project.subject.as_deref(),
                manifest.project.transcriber.as_deref(),
            ],
        )
        .map_err(CommandError::from)?;

        for (old_fid, file_name, file_type, audio_leaf, audio_bytes, segments, peaks_prefix) in files
        {
            let new_file_id = Uuid::new_v4().to_string();
            let ext = Path::new(audio_leaf)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("dat")
                .to_ascii_lowercase();
            let dest_audio = dest_proj.join(format!("{new_file_id}.{ext}"));
            fs::write(&dest_audio, audio_bytes).map_err(CommandError::BundleWriteAudio)?;
            let audio_path = persist_audio_storage_path(&media_base, &dest_audio)
                .map_err(|detail| CommandError::ImportProjectBundle { detail })?;

            let ft = if file_type == "text" || file_type == "audio_only" || file_type == "paired" {
                file_type.as_str()
            } else {
                "paired"
            };
            tx.execute(
                "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    &new_file_id,
                    &id,
                    file_name,
                    ft,
                    audio_path,
                    created_at_ms,
                    now,
                ],
            )
            .map_err(CommandError::from)?;
            insert_segments(&tx, &new_file_id, segments)?;

            if let Some(prefix) = peaks_prefix {
                extract_peaks_from_zip(archive, prefix, old_fid, &peaks_root, &new_file_id)?;
            }
        }

        for entry in edit_log {
            tx.execute(
                "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
                params![&id, entry.at_ms, entry.kind.as_str(), entry.detail.as_str()],
            )
            .map_err(CommandError::from)?;
        }

        let detail = serde_json::json!({
            "op": "import_project_bundle",
            "bundle_version": manifest.version,
            "source_project_id": manifest.project.original_id,
            "source_updated_at_ms": manifest.project.updated_at_ms,
            "source_zip": zip_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown"),
            "file_count": files.len(),
            "at_ms": now,
        })
        .to_string();
        tx.execute(
            "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
            params![&id, now, "import_project_bundle", detail.as_str()],
        )
        .map_err(CommandError::from)?;
        tx.commit().map_err(CommandError::from)?;
        Ok(())
    })();

    if let Err(e) = db_result {
        let _ = fs::remove_dir_all(&dest_proj);
        return Err(e);
    }

    match read_zip_bytes(archive, PROJECT_BUNDLE_LEXICON_ENTRY) {
        Ok(lexicon_bytes) => {
            if let Err(e) = apply_embedded_lexicon(st, &lexicon_bytes) {
                let _ = open_db(st).and_then(|conn| {
                    conn.execute("DELETE FROM projects WHERE id = ?1", params![&id])
                        .map_err(|err| err.to_string())
                });
                let _ = fs::remove_dir_all(&dest_proj);
                return Err(e);
            }
        }
        Err(CommandError::BundleMissingEntry { .. }) if !manifest.includes_lexicon => {}
        Err(e) => {
            let _ = open_db(st).and_then(|conn| {
                conn.execute("DELETE FROM projects WHERE id = ?1", params![&id])
                    .map_err(|err| err.to_string())
            });
            let _ = fs::remove_dir_all(&dest_proj);
            return Err(e);
        }
    }

    let conn = open_db(st).map_err(CommandError::db_pool)?;
    project_detail_from_conn(&conn, &id)
        .map_err(|detail| CommandError::ImportProjectBundle { detail })
}

fn apply_embedded_lexicon(st: &DbState, raw: &[u8]) -> CommandResult<()> {
    let text = std::str::from_utf8(raw).map_err(|e| CommandError::ImportProjectBundle {
        detail: format!("lexicon.json 不是合法 UTF-8：{e}"),
    })?;
    let doc = parse_lexicon_bundle_json(text)
        .map_err(|detail| CommandError::ImportProjectBundle { detail })?;
    let mut conn = open_db(st).map_err(CommandError::db_pool)?;
    let preview = preview_lexicon_bundle_import(&conn, &doc)
        .map_err(|detail| CommandError::ImportProjectBundle { detail })?;
    // Silent handoff: keep local on conflict; insert only missing terms/rules.
    let resolutions: Vec<LexiconBundleConflictResolution> = preview
        .conflicts
        .iter()
        .map(|c| LexiconBundleConflictResolution {
            id: c.id.clone(),
            choice: "skip".into(),
        })
        .collect();
    apply_lexicon_bundle_import(&mut conn, &doc, &resolutions)
        .map_err(|detail| CommandError::ImportProjectBundle { detail })?;
    Ok(())
}

fn resolve_audio_path_media_base(st: &DbState) -> CommandResult<PathBuf> {
    crate::media_base_dir::resolve_media_base(st)
        .map_err(|detail| CommandError::ImportProjectBundle { detail })
}

use super::import_parse::{parse_srt, parse_txt};
use super::types::SegmentDto;
use super::utils::open_db;
use crate::DbState;
use rusqlite::params;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDuplicateFileMatch {
    pub file_id: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDuplicateCheck {
    pub by_source_path: Vec<ImportDuplicateFileMatch>,
    pub by_content_hash: Vec<ImportDuplicateFileMatch>,
}

#[derive(Debug, Clone)]
pub struct ImportProvenance {
    pub source_path: String,
    pub content_sha256: String,
    pub source_size: i64,
    pub source_modified_ms: i64,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct SourceFileMeta {
    size: i64,
    modified_ms: i64,
}

#[derive(Debug, Clone)]
struct IncomingImportCheck {
    bytes_hash: String,
    meta: SourceFileMeta,
    text_segment_fingerprint: Option<String>,
}

pub fn normalize_import_source_path(raw: &str) -> String {
    let path = PathBuf::from(raw);
    std::fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| raw.trim().to_string())
}

pub fn source_file_meta(path: &Path) -> Result<SourceFileMeta, String> {
    let meta = fs_metadata(path)?;
    let modified_ms = meta
        .modified()
        .map_err(|e| format!("读取文件时间失败: {e}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("读取文件时间失败: {e}"))?
        .as_millis() as i64;
    Ok(SourceFileMeta {
        size: meta.len() as i64,
        modified_ms,
    })
}

fn fs_metadata(path: &Path) -> Result<std::fs::Metadata, String> {
    std::fs::metadata(path).map_err(|e| format!("读取文件失败: {e}"))
}

pub fn file_sha256_hex(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("读取文件失败: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0_u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("读取文件失败: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// Stable fingerprint for imported text segments (legacy backfill + txt/srt re-import).
pub fn segments_content_fingerprint(segments: &[SegmentDto]) -> String {
    let mut hasher = Sha256::new();
    for s in segments {
        hasher.update(format!("{}|{:.6}|{:.6}|", s.idx, s.start_sec, s.end_sec).as_bytes());
        hasher.update(s.text.as_bytes());
        hasher.update(b"\n---\n");
    }
    hex::encode(hasher.finalize())
}

fn is_text_import_path(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("txt") || e.eq_ignore_ascii_case("srt") || e.eq_ignore_ascii_case("vtt"))
        .unwrap_or(false)
}

pub fn text_source_segment_fingerprint(path: &Path) -> Result<Option<String>, String> {
    if !is_text_import_path(path) {
        return Ok(None);
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_ascii_lowercase();
    let content =
        std::fs::read_to_string(path).map_err(|e| format!("读取文件失败: {e}"))?;
    let segments = if ext == "srt" || ext == "vtt" {
        parse_srt(&content)?
    } else {
        parse_txt(&content)
    };
    Ok(Some(segments_content_fingerprint(&segments)))
}

fn segments_fingerprint_from_db(
    conn: &rusqlite::Connection,
    file_id: &str,
) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT idx, start_sec, end_sec, text FROM segments WHERE file_id = ?1 ORDER BY idx ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![file_id], |row| {
            Ok(SegmentDto {
                uid: None,
                idx: row.get(0)?,
                start_sec: row.get(1)?,
                end_sec: row.get(2)?,
                text: row.get(3)?,
                confidence: None,
                low_confidence: false,
                detail: None,
                kind: None,
                text_stage: String::new(),
                finalize_via: None,
            annotation: None,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut segments = Vec::new();
    for row in rows {
        segments.push(row.map_err(|e| e.to_string())?);
    }
    if segments.is_empty() {
        return Ok(None);
    }
    Ok(Some(segments_content_fingerprint(&segments)))
}

fn hashes_equal(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

fn content_hash_matches(incoming: &IncomingImportCheck, candidate: &str) -> bool {
    if hashes_equal(&incoming.bytes_hash, candidate) {
        return true;
    }
    if let Some(ref fp) = incoming.text_segment_fingerprint {
        if hashes_equal(fp, candidate) {
            return true;
        }
    }
    false
}

fn hash_audio_copy(path: &Path, cache: &mut HashMap<String, String>) -> Option<String> {
    let key = path.to_string_lossy().to_string();
    if let Some(cached) = cache.get(&key) {
        return if cached.is_empty() {
            None
        } else {
            Some(cached.clone())
        };
    }
    let hash = file_sha256_hex(path).unwrap_or_default();
    cache.insert(key, hash.clone());
    if hash.is_empty() {
        None
    } else {
        Some(hash)
    }
}

pub fn import_provenance_for_src(src_path: &str) -> Result<ImportProvenance, String> {
    let path = PathBuf::from(src_path);
    if !path.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let meta = source_file_meta(&path)?;
    Ok(ImportProvenance {
        source_path: normalize_import_source_path(src_path),
        content_sha256: file_sha256_hex(&path)?,
        source_size: meta.size,
        source_modified_ms: meta.modified_ms,
    })
}

pub fn check_import_duplicate_inner(
    conn: &rusqlite::Connection,
    project_id: &str,
    src_path: &str,
) -> Result<ImportDuplicateCheck, String> {
    let src = PathBuf::from(src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let canonical_src = normalize_import_source_path(src_path);

    let mut stmt = conn
        .prepare(
            "SELECT id, name, file_type, import_source_path, import_content_sha256, \
                    import_source_size, import_source_modified_ms, audio_path \
             FROM files WHERE project_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<_> = stmt
        .query_map(params![project_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<i64>>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut by_source_path = Vec::new();
    for (file_id, file_name, _, stored_path, _, _, _, _) in &rows {
        if stored_path
            .as_deref()
            .is_some_and(|sp| sp == canonical_src)
        {
            by_source_path.push(ImportDuplicateFileMatch {
                file_id: file_id.clone(),
                file_name: file_name.clone(),
            });
        }
    }

    if !by_source_path.is_empty() {
        return Ok(ImportDuplicateCheck {
            by_source_path,
            by_content_hash: Vec::new(),
        });
    }

    let meta = source_file_meta(&src)?;
    let incoming = IncomingImportCheck {
        bytes_hash: file_sha256_hex(&src)?,
        meta,
        text_segment_fingerprint: text_source_segment_fingerprint(&src)?,
    };

    let mut by_content_hash = Vec::new();
    let mut audio_hash_cache: HashMap<String, String> = HashMap::new();
    let mut segment_fp_cache: HashMap<String, String> = HashMap::new();

    for (
        file_id,
        file_name,
        file_type,
        _stored_path,
        stored_hash,
        stored_size,
        _stored_modified_ms,
        audio_path,
    ) in rows
    {
        if file_type != "text" {
            if let (Some(stored_sz), None) = (stored_size, stored_hash.as_ref()) {
                if stored_sz != incoming.meta.size {
                    continue;
                }
            }
        }

        let mut hash_match = stored_hash
            .as_deref()
            .is_some_and(|h| content_hash_matches(&incoming, h));

        if !hash_match {
            if file_type == "text" {
                let db_fp = segment_fp_cache.entry(file_id.clone()).or_insert_with(|| {
                    segments_fingerprint_from_db(conn, &file_id)
                        .ok()
                        .flatten()
                        .unwrap_or_default()
                });
                if !db_fp.is_empty() && content_hash_matches(&incoming, db_fp) {
                    hash_match = true;
                }
            } else if stored_hash.is_none() {
                if let Some(ap) = audio_path {
                    let ap_path = PathBuf::from(&ap);
                    if ap_path.is_file() {
                        if let Some(cached_hash) = hash_audio_copy(&ap_path, &mut audio_hash_cache) {
                            hash_match = hashes_equal(&cached_hash, &incoming.bytes_hash);
                        }
                    }
                }
            }
        }

        if hash_match {
            by_content_hash.push(ImportDuplicateFileMatch { file_id, file_name });
        }
    }

    Ok(ImportDuplicateCheck {
        by_source_path: Vec::new(),
        by_content_hash,
    })
}

/// One-time backfill for legacy rows missing provenance (run from db migrate).
pub fn backfill_files_import_provenance(conn: &rusqlite::Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, file_type, import_source_path, import_content_sha256, import_source_size, audio_path \
             FROM files WHERE import_content_sha256 IS NULL OR import_source_size IS NULL",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (file_id, file_type, source_path, existing_hash, existing_size, audio_path) =
            row.map_err(|e| e.to_string())?;

        let mut hash = existing_hash;
        let mut meta: Option<SourceFileMeta> = None;

        if let Some(sp) = source_path.as_deref() {
            let path = PathBuf::from(sp);
            if path.is_file() {
                meta = source_file_meta(&path).ok();
                if hash.is_none() {
                    hash = file_sha256_hex(&path).ok();
                }
            }
        }

        if hash.is_none() && file_type == "text" {
            hash = segments_fingerprint_from_db(conn, &file_id).ok().flatten();
        }

        if hash.is_none() {
            if let Some(ap) = audio_path.as_deref() {
                let path = PathBuf::from(ap);
                if path.is_file() {
                    if meta.is_none() {
                        meta = source_file_meta(&path).ok();
                    }
                    hash = file_sha256_hex(&path).ok();
                }
            }
        }

        if existing_size.is_some() && hash.is_none() {
            continue;
        }

        let Some(h) = hash else {
            continue;
        };

        let (size, modified_ms) = if let Some(m) = meta {
            (m.size, m.modified_ms)
        } else {
            (existing_size.unwrap_or(0), 0)
        };

        conn.execute(
            "UPDATE files SET import_content_sha256 = ?1, import_source_size = ?2, \
             import_source_modified_ms = ?3 WHERE id = ?4",
            params![h, size, modified_ms, file_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn check_project_import_duplicate(
    state: State<DbState>,
    project_id: String,
    src_path: String,
) -> Result<ImportDuplicateCheck, String> {
    let st: &DbState = state.deref();
    let conn = open_db(st)?;
    check_import_duplicate_inner(&conn, &project_id, &src_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
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
            params![project_id, "P", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, import_source_path, import_content_sha256, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
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
            params![file_id, "uid-1", 0, 0.0, 1.0, text],
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

        let check = check_import_duplicate_inner(&conn, "p1", src.to_str().unwrap()).unwrap();
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

        let check = check_import_duplicate_inner(&conn, "p1", incoming.to_str().unwrap()).unwrap();
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
                params![ "f1", "uid-1", s.idx, s.start_sec, s.end_sec, s.text ],
            )
            .unwrap();
        }

        let check =
            check_import_duplicate_inner(&conn, "p1", incoming.to_str().unwrap()).unwrap();
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

        let check = check_import_duplicate_inner(&conn, "p1", incoming.to_str().unwrap()).unwrap();
        assert!(check.by_content_hash.is_empty());

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
}

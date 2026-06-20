use std::collections::HashMap;
use std::path::PathBuf;

use rusqlite::params;

use super::hash::{
    content_hash_matches, file_sha256_hex, hash_audio_copy, segments_fingerprint_from_db,
    text_source_segment_fingerprint,
};
use super::path_meta::{normalize_import_source_path, source_file_meta};
use super::types::{ImportDuplicateCheck, ImportDuplicateFileMatch, IncomingImportCheck};

pub fn check_import_duplicate_inner(
    conn: &rusqlite::Connection,
    project_id: &str,
    src_path: &str,
    replace_target_file_id: Option<&str>,
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
        if stored_path.as_deref().is_some_and(|sp| sp == canonical_src) {
            by_source_path.push(ImportDuplicateFileMatch {
                file_id: file_id.clone(),
                file_name: file_name.clone(),
            });
        }
    }

    if !by_source_path.is_empty() {
        return Ok(filter_replace_target_bypass(
            ImportDuplicateCheck {
                by_source_path,
                by_content_hash: Vec::new(),
            },
            replace_target_file_id,
        ));
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
                        if let Some(cached_hash) = hash_audio_copy(&ap_path, &mut audio_hash_cache)
                        {
                            hash_match = content_hash_matches(&incoming, &cached_hash);
                        }
                    }
                }
            }
        }

        if hash_match {
            by_content_hash.push(ImportDuplicateFileMatch { file_id, file_name });
        }
    }

    Ok(filter_replace_target_bypass(
        ImportDuplicateCheck {
            by_source_path: Vec::new(),
            by_content_hash,
        },
        replace_target_file_id,
    ))
}

fn filter_replace_target_bypass(
    check: ImportDuplicateCheck,
    replace_target_file_id: Option<&str>,
) -> ImportDuplicateCheck {
    let Some(target_id) = replace_target_file_id else {
        return check;
    };
    ImportDuplicateCheck {
        by_source_path: check
            .by_source_path
            .into_iter()
            .filter(|m| m.file_id != target_id)
            .collect(),
        by_content_hash: check
            .by_content_hash
            .into_iter()
            .filter(|m| m.file_id != target_id)
            .collect(),
    }
}

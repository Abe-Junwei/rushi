use std::path::PathBuf;

use rusqlite::params;

use super::hash::{file_sha256_hex, segments_fingerprint_from_db};
use super::path_meta::source_file_meta;
use super::types::SourceFileMeta;

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

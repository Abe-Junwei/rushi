use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;

use rusqlite::params;
use sha2::{Digest, Sha256};

use super::super::import_parse::{parse_srt, parse_txt};
use super::super::types::SegmentDto;
use super::types::IncomingImportCheck;

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
        .map(|e| {
            e.eq_ignore_ascii_case("txt")
                || e.eq_ignore_ascii_case("srt")
                || e.eq_ignore_ascii_case("vtt")
        })
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
    let content = std::fs::read_to_string(path).map_err(|e| format!("读取文件失败: {e}"))?;
    let segments = if ext == "srt" || ext == "vtt" {
        parse_srt(&content)?
    } else {
        parse_txt(&content)
    };
    Ok(Some(segments_content_fingerprint(&segments)))
}

pub(crate) fn segments_fingerprint_from_db(
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
                frozen: false,
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

pub(crate) fn content_hash_matches(incoming: &IncomingImportCheck, candidate: &str) -> bool {
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

pub(crate) fn hash_audio_copy(path: &Path, cache: &mut HashMap<String, String>) -> Option<String> {
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

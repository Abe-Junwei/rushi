//! Unique display names across the whole workspace (Finder-style `name (2).ext`).

use rusqlite::{Connection, Error};

fn row_exists(
    conn: &Connection,
    sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> Result<bool, String> {
    match conn.query_row(sql, params, |_| Ok(())) {
        Ok(()) => Ok(true),
        Err(Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

pub fn name_taken(
    conn: &Connection,
    name: &str,
    exclude_file_id: Option<&str>,
) -> Result<bool, String> {
    match exclude_file_id {
        Some(id) => row_exists(
            conn,
            "SELECT 1 FROM files WHERE name = ?1 AND id != ?2",
            &[&name as &dyn rusqlite::ToSql, &id],
        ),
        None => row_exists(
            conn,
            "SELECT 1 FROM files WHERE name = ?1",
            &[&name as &dyn rusqlite::ToSql],
        ),
    }
}

/// Split `clip.wav` → (`clip`, `.wav`); `clip` → (`clip`, ``).
pub fn split_file_stem_ext(name: &str) -> (String, String) {
    let path = std::path::Path::new(name);
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) if name.len() > ext.len() + 1 && !name.starts_with('.') => {
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(name)
                .to_string();
            (stem, format!(".{ext}"))
        }
        _ => (name.to_string(), String::new()),
    }
}

pub fn unique_file_name(
    conn: &Connection,
    desired: &str,
    exclude_file_id: Option<&str>,
) -> Result<String, String> {
    let desired = desired.trim();
    if desired.is_empty() {
        return Err("文件名不能为空。".into());
    }
    if !name_taken(conn, desired, exclude_file_id)? {
        return Ok(desired.to_string());
    }
    let (stem, ext) = split_file_stem_ext(desired);
    for n in 2u32..10_000 {
        let candidate = format!("{stem} ({n}){ext}");
        if !name_taken(conn, &candidate, exclude_file_id)? {
            return Ok(candidate);
        }
    }
    Err("无法生成不冲突的文件名。".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_keeps_extension() {
        assert_eq!(
            split_file_stem_ext("clip.wav"),
            ("clip".into(), ".wav".into())
        );
        assert_eq!(split_file_stem_ext("noext"), ("noext".into(), "".into()));
    }
}

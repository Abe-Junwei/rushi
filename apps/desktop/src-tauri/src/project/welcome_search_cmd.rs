use super::types::{WelcomeContentSearchHit, WelcomeFileSearchHit};
use super::utils::open_db;
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use tauri::State;

const DEFAULT_FILE_LIMIT: u32 = 30;
const DEFAULT_CONTENT_LIMIT: u32 = 40;
const SNIPPET_CONTEXT_CHARS: usize = 24;

fn normalize_query(query: &str) -> Option<String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn escape_like(raw: &str) -> String {
    raw.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn like_pattern(query: &str) -> String {
    format!("%{}%", escape_like(query))
}

fn find_insensitive_range(text: &str, query: &str) -> Option<(usize, usize)> {
    if query.is_empty() {
        return None;
    }
    let hay = text.to_lowercase();
    let needle = query.to_lowercase();
    let byte_start = hay.find(&needle)?;
    let char_start = text[..byte_start].chars().count();
    let char_end = char_start + query.chars().count();
    Some((char_start, char_end))
}

pub fn build_content_snippet(text: &str, query: &str) -> (String, usize, usize) {
    let Some((char_start, char_end)) = find_insensitive_range(text, query) else {
        let preview: String = text.chars().take(SNIPPET_CONTEXT_CHARS * 2).collect();
        return (preview, 0, 0);
    };

    let chars: Vec<char> = text.chars().collect();
    let left = char_start.saturating_sub(SNIPPET_CONTEXT_CHARS);
    let right = (char_end + SNIPPET_CONTEXT_CHARS).min(chars.len());
    let mut snippet: String = chars[left..right].iter().collect();
    if left > 0 {
        snippet = format!("…{snippet}");
    }
    if right < chars.len() {
        snippet.push('…');
    }
    (snippet, char_start, char_end)
}

pub fn welcome_search_files_inner(
    state: &DbState,
    query: &str,
    limit: u32,
) -> Result<Vec<WelcomeFileSearchHit>, String> {
    let Some(query) = normalize_query(query) else {
        return Ok(Vec::new());
    };
    let pattern = like_pattern(&query);
    let conn = open_db(state)?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, f.id, f.name, f.updated_at_ms, \
             CASE \
               WHEN f.name LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 'file_name' \
               WHEN p.name LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 'project_name' \
               WHEN IFNULL(p.narrator, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 'narrator' \
               WHEN IFNULL(p.recorded_at, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 'recorded_at' \
               WHEN IFNULL(p.location, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 'location' \
               WHEN IFNULL(p.subject, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 'subject' \
               WHEN IFNULL(p.transcriber, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 'transcriber' \
               ELSE 'file_name' \
             END AS matched_field \
             FROM files f \
             INNER JOIN projects p ON p.id = f.project_id \
             WHERE f.name LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
                OR p.name LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
                OR IFNULL(p.narrator, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
                OR IFNULL(p.recorded_at, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
                OR IFNULL(p.location, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
                OR IFNULL(p.subject, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
                OR IFNULL(p.transcriber, '') LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
             ORDER BY f.updated_at_ms DESC \
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![pattern, limit as i64], |r| {
            Ok(WelcomeFileSearchHit {
                project_id: r.get(0)?,
                project_name: r.get(1)?,
                file_id: r.get(2)?,
                file_name: r.get(3)?,
                updated_at_ms: r.get(4)?,
                matched_field: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn welcome_search_content_inner(
    state: &DbState,
    query: &str,
    limit: u32,
) -> Result<Vec<WelcomeContentSearchHit>, String> {
    let Some(query) = normalize_query(query) else {
        return Ok(Vec::new());
    };
    let pattern = like_pattern(&query);
    let conn = open_db(state)?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, f.id, f.name, s.idx, s.start_sec, s.end_sec, s.text \
             FROM segments s \
             JOIN files f ON f.id = s.file_id \
             JOIN projects p ON p.id = f.project_id \
             WHERE s.text LIKE ?1 ESCAPE '\\' COLLATE NOCASE \
             ORDER BY f.updated_at_ms DESC, s.idx ASC \
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![pattern, limit as i64], |r| {
            let text: String = r.get(7)?;
            let (snippet, char_start, char_end) = build_content_snippet(&text, &query);
            Ok(WelcomeContentSearchHit {
                project_id: r.get(0)?,
                project_name: r.get(1)?,
                file_id: r.get(2)?,
                file_name: r.get(3)?,
                segment_idx: r.get(4)?,
                start_sec: r.get(5)?,
                end_sec: r.get(6)?,
                snippet,
                char_start,
                char_end,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn welcome_search_files(
    state: State<DbState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<WelcomeFileSearchHit>, String> {
    welcome_search_files_inner(state.deref(), &query, limit.unwrap_or(DEFAULT_FILE_LIMIT))
}

#[tauri::command]
pub fn welcome_search_content(
    state: State<DbState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<WelcomeContentSearchHit>, String> {
    welcome_search_content_inner(
        state.deref(),
        &query,
        limit.unwrap_or(DEFAULT_CONTENT_LIMIT),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
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
        let root = std::env::temp_dir().join(format!("rushi_welcome_search_{label}_{unique}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn seed_project_file(
        st: &DbState,
        project_name: &str,
        file_name: &str,
        narrator: Option<&str>,
        segment_text: &str,
    ) -> (String, String) {
        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let t = 1_700_000_000_000_i64;
        let conn = open_db(st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms, narrator) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![&project_id, project_name, t, t, narrator],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&file_id, &project_id, file_name, "text", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, idx, start_sec, end_sec, text) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![&file_id, 0_i32, 0.0_f64, 1.0_f64, segment_text],
        )
        .unwrap();
        (project_id, file_id)
    }

    #[test]
    fn welcome_search_files_matches_name_and_metadata_case_insensitive() {
        let st = DbState::open_test_db(test_root("files"));
        let (_pid, fid) =
            seed_project_file(&st, "Alpha 项目", "访谈稿.txt", Some("张三"), "无关正文");

        let by_file = welcome_search_files_inner(&st, "访谈", 10).unwrap();
        assert_eq!(by_file.len(), 1);
        assert_eq!(by_file[0].file_id, fid);
        assert_eq!(by_file[0].matched_field, "file_name");

        let by_narrator = welcome_search_files_inner(&st, "zhang", 10).unwrap();
        assert!(by_narrator.is_empty());
        let by_narrator_cn = welcome_search_files_inner(&st, "张三", 10).unwrap();
        assert_eq!(by_narrator_cn.len(), 1);
        assert_eq!(by_narrator_cn[0].matched_field, "narrator");
    }

    #[test]
    fn welcome_search_content_finds_segment_text() {
        let st = DbState::open_test_db(test_root("content"));
        let (_pid, fid) =
            seed_project_file(&st, "Beta", "audio.wav", None, "村里有一段抗美援朝的故事");

        let hits = welcome_search_content_inner(&st, "抗美援朝", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].file_id, fid);
        assert_eq!(hits[0].segment_idx, 0);
        assert!(hits[0].snippet.contains("抗美援朝"));
        assert!(hits[0].char_end > hits[0].char_start);
    }

    #[test]
    fn build_content_snippet_finds_unicode_range() {
        let (snippet, start, end) = build_content_snippet("前言抗美援朝后记", "抗美援朝");
        assert!(snippet.contains("抗美援朝"));
        assert_eq!(start, 2);
        assert_eq!(end, 6);
    }
}

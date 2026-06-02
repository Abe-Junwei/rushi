use super::types::SegmentDto;
use super::utils::now_ms;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};

const CORRECTION_RULE_WARNING_PREFIX: &str = "correction_rule_hint:";

pub fn load_file_segment_texts(
    conn: &Connection,
    file_id: &str,
) -> Result<HashMap<i32, String>, String> {
    let mut stmt = conn
        .prepare("SELECT idx, text FROM segments WHERE file_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![file_id], |r| {
            Ok((r.get::<_, i32>(0)?, r.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut out = HashMap::new();
    for row in rows {
        let (idx, text) = row.map_err(|e| e.to_string())?;
        out.insert(idx, text);
    }
    Ok(out)
}

/// 从前后文本中提取“单一替换片段”（用于错词记忆），例如“安波那那” -> “安那般那”。
pub fn infer_single_replacement(before: &str, after: &str) -> Option<(String, String)> {
    let b = before.trim();
    let a = after.trim();
    if b.is_empty() || a.is_empty() || b == a {
        return None;
    }
    let b_chars: Vec<char> = b.chars().collect();
    let a_chars: Vec<char> = a.chars().collect();
    if b_chars.len() > 80 || a_chars.len() > 80 {
        return None;
    }
    let mut left = 0usize;
    while left < b_chars.len() && left < a_chars.len() && b_chars[left] == a_chars[left] {
        left += 1;
    }
    let mut right = 0usize;
    while right + left < b_chars.len()
        && right + left < a_chars.len()
        && b_chars[b_chars.len() - 1 - right] == a_chars[a_chars.len() - 1 - right]
    {
        right += 1;
    }
    let removed: String = b_chars[left..(b_chars.len().saturating_sub(right))]
        .iter()
        .collect::<String>()
        .trim()
        .to_string();
    let added: String = a_chars[left..(a_chars.len().saturating_sub(right))]
        .iter()
        .collect::<String>()
        .trim()
        .to_string();
    if removed.is_empty() || added.is_empty() || removed == added {
        return None;
    }
    if removed.chars().count() > 24 || added.chars().count() > 24 {
        return None;
    }
    if removed.chars().any(char::is_whitespace) || added.chars().any(char::is_whitespace) {
        return None;
    }
    Some((removed, added))
}

pub fn upsert_correction_memory(
    conn: &Connection,
    before_text: &str,
    after_text: &str,
    at_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO correction_memory \
         (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms)\
         VALUES (?1, ?2, 1, 0, ?3, ?3)\
         ON CONFLICT(before_text, after_text)\
         DO UPDATE SET hit_count = hit_count + 1, updated_at_ms = excluded.updated_at_ms",
        params![before_text, after_text, at_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_correction_memory_from_save(
    conn: &Connection,
    old_text_by_idx: &HashMap<i32, String>,
    new_segments: &[SegmentDto],
) -> Result<(), String> {
    // 中文说明 | English: only learn from stable one-to-one edits to avoid noisy split/merge diffs.
    if old_text_by_idx.len() != new_segments.len() {
        return Ok(());
    }
    let at_ms = now_ms();
    for seg in new_segments {
        let Some(prev) = old_text_by_idx.get(&seg.idx) else {
            continue;
        };
        if let Some((before_text, after_text)) = infer_single_replacement(prev, &seg.text) {
            upsert_correction_memory(conn, &before_text, &after_text, at_ms)?;
        }
    }
    Ok(())
}

pub fn accept_correction_rule(
    conn: &Connection,
    before_text: &str,
    after_text: &str,
    at_ms: i64,
) -> Result<(), String> {
    let before_text = before_text.trim();
    let after_text = after_text.trim();
    if before_text.is_empty() || after_text.is_empty() || before_text == after_text {
        return Err("纠错规则前后文本无效。".to_string());
    }
    conn.execute(
        "INSERT INTO correction_memory \
         (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms)\
         VALUES (?1, ?2, 1, 1, ?3, ?3)\
         ON CONFLICT(before_text, after_text)\
         DO UPDATE SET accepted_as_rule = 1, updated_at_ms = excluded.updated_at_ms",
        params![before_text, after_text, at_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn collect_correction_rule_hints(
    conn: &Connection,
    segments: &[SegmentDto],
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text FROM correction_memory \
             WHERE accepted_as_rule = 1 OR hit_count >= 2 \
             ORDER BY accepted_as_rule DESC, hit_count DESC, updated_at_ms DESC \
             LIMIT 40",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for row in rows {
        let (before_text, after_text) = row.map_err(|e| e.to_string())?;
        if before_text.trim().is_empty() || after_text.trim().is_empty() {
            continue;
        }
        if segments
            .iter()
            .any(|s| s.text.contains(&before_text) && !s.text.contains(&after_text))
            && seen.insert((before_text.clone(), after_text.clone()))
        {
            out.push(format!(
                "{CORRECTION_RULE_WARNING_PREFIX}{before_text}->{after_text}"
            ));
            if out.len() >= 5 {
                break;
            }
        }
    }
    Ok(out)
}

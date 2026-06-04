use super::correction_hints::maybe_auto_add_glossary_for_memory_hit;
use super::correction_types::CORRECTION_MEMORY_STABLE_HIT;
use crate::project::types::SegmentDto;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};

fn is_correction_punctuation(c: char) -> bool {
    matches!(
        c,
        '，' | '。' | '！' | '？' | '；' | '、' | ',' | '.' | '!' | '?' | ';' | ':' | '：'
    )
}

fn is_correction_learn_noise(c: char) -> bool {
    is_correction_punctuation(c) || c.is_whitespace()
}

fn strip_correction_learn_noise(s: &str) -> String {
    s.chars()
        .filter(|c| !is_correction_learn_noise(*c))
        .collect()
}

pub(crate) fn normalize_correction_learn_pair(
    removed: &str,
    added: &str,
) -> Option<(String, String)> {
    let before = strip_correction_learn_noise(removed.trim());
    let after = strip_correction_learn_noise(added.trim());
    if before.is_empty() || after.is_empty() || before == after {
        return None;
    }
    Some((before, after))
}

fn is_cjk_char(c: char) -> bool {
    matches!(
        c as u32,
        0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0x20000..=0x2A6DF
    )
}

fn is_latin_letters_only(s: &str) -> bool {
    let t = s.trim();
    !t.is_empty() && t.chars().all(|c| c.is_ascii_alphabetic())
}

/// 拒绝 IME 拼音缓冲（如 lian）与中文混学的误记。
pub(crate) fn should_learn_inferred_replacement(removed: &str, added: &str) -> bool {
    let Some((removed, added)) = normalize_correction_learn_pair(removed, added) else {
        return false;
    };
    if is_latin_letters_only(&removed) || is_latin_letters_only(&added) {
        return false;
    }
    /// 词条级纠错，避免整句/相邻语段误学（通常 >8 字）
    const MAX_SPAN_CHARS: usize = 8;
    if removed.chars().count() > MAX_SPAN_CHARS || added.chars().count() > MAX_SPAN_CHARS {
        return false;
    }
    // 单字 CJK 对：不自动学习（业内显式词条/短语；见 r3t-f-edit-memory-for-llm-research §4.3）
    if removed.chars().count() == 1
        && added.chars().count() == 1
        && is_cjk_char(removed.chars().next().unwrap())
        && is_cjk_char(added.chars().next().unwrap())
    {
        return false;
    }
    true
}

/// 语段保存前后最小单区间替换（整段词优先，否则字素级前缀/后缀剥离）。
pub fn infer_single_replacement(before: &str, after: &str) -> Option<(String, String)> {
    if let Some(whole) = normalize_correction_learn_pair(before, after) {
        if should_learn_inferred_replacement(&whole.0, &whole.1) {
            return Some(whole);
        }
    }
    let b: Vec<char> = before.chars().collect();
    let a: Vec<char> = after.chars().collect();
    let mut prefix = 0usize;
    while prefix < b.len() && prefix < a.len() && b[prefix] == a[prefix] {
        prefix += 1;
    }
    let mut b_end = b.len();
    let mut a_end = a.len();
    while b_end > prefix && a_end > prefix && b[b_end - 1] == a[a_end - 1] {
        b_end -= 1;
        a_end -= 1;
    }
    let removed: String = b[prefix..b_end].iter().collect();
    let added: String = a[prefix..a_end].iter().collect();
    normalize_correction_learn_pair(&removed, &added)
}

fn learn_pairs_from_segment_text_change(
    pairs: &mut HashSet<(String, String)>,
    before_full: &str,
    after_full: &str,
    registered: &[(String, String)],
) {
    if before_full == after_full {
        return;
    }
    for (before_text, after_text) in registered {
        if !before_full.contains(before_text) {
            continue;
        }
        if !after_full.contains(after_text) {
            continue;
        }
        if after_full.contains(before_text) {
            continue;
        }
        pairs.insert((before_text.clone(), after_text.clone()));
    }
    if let Some((before_text, after_text)) = infer_single_replacement(before_full, after_full) {
        if should_learn_inferred_replacement(&before_text, &after_text) {
            pairs.insert((before_text, after_text));
        }
    }
}

fn list_memory_pairs_for_save_learn(conn: &Connection) -> Result<Vec<(String, String)>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text FROM correction_memory \
             WHERE trim(before_text) != '' AND trim(after_text) != '' \
             ORDER BY updated_at_ms DESC LIMIT 200",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (b, a) = row.map_err(|e| e.to_string())?;
        let b = b.trim().to_string();
        let a = a.trim().to_string();
        if !b.is_empty() && !a.is_empty() && b != a {
            out.push((b, a));
        }
    }
    Ok(out)
}

/// 保存语段时：对比 baseline 与当前正文，对已纳入记忆对或合法单区间替换计一次命中。
pub fn learn_inferred_pairs_from_segment_save(
    conn: &Connection,
    baseline_by_uid: &HashMap<String, String>,
    segments: &[SegmentDto],
    at_ms: i64,
) -> Result<(), String> {
    let registered = list_memory_pairs_for_save_learn(conn)?;
    let mut pairs: HashSet<(String, String)> = HashSet::new();
    for s in segments {
        let uid = s.uid.as_deref().unwrap_or("").trim();
        if uid.is_empty() {
            continue;
        }
        let before = baseline_by_uid.get(uid).map(String::as_str).unwrap_or("");
        let after = s.text.as_str();
        learn_pairs_from_segment_text_change(&mut pairs, before, after, &registered);
    }
    for (before_text, after_text) in pairs {
        upsert_correction_memory(conn, &before_text, &after_text, at_ms)?;
    }
    Ok(())
}

/// User-confirmed wrong→right pairs (e.g. Replace All); always upserts when non-empty.
pub fn upsert_explicit_correction_pairs(
    conn: &Connection,
    pairs: &[(String, String)],
    at_ms: i64,
) -> Result<(), String> {
    for (before_text, after_text) in pairs {
        let Some((before_text, after_text)) =
            normalize_correction_learn_pair(before_text, after_text)
        else {
            continue;
        };
        if !should_learn_inferred_replacement(&before_text, &after_text) {
            continue;
        }
        upsert_correction_memory(conn, &before_text, &after_text, at_ms)?;
    }
    Ok(())
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
    let hit_count: i32 = conn
        .query_row(
            "SELECT hit_count FROM correction_memory WHERE before_text = ?1 AND after_text = ?2",
            params![before_text, after_text],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let _ = maybe_auto_add_glossary_for_memory_hit(conn, after_text, before_text, hit_count, at_ms);
    Ok(())
}

pub fn is_correction_memory_stable(hit_count: i32, accepted_as_rule: bool) -> bool {
    accepted_as_rule || hit_count >= CORRECTION_MEMORY_STABLE_HIT
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

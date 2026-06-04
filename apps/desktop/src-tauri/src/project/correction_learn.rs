use rusqlite::{params, Connection};

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

pub(crate) fn normalize_correction_learn_pair(removed: &str, added: &str) -> Option<(String, String)> {
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

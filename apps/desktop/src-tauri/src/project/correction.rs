use super::types::SegmentDto;
use super::utils::now_ms;
use rusqlite::{params, Connection};
use std::collections::HashSet;

const CORRECTION_RULE_WARNING_PREFIX: &str = "correction_rule_hint:";

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

fn normalize_correction_learn_pair(removed: &str, added: &str) -> Option<(String, String)> {
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
fn should_learn_inferred_replacement(removed: &str, added: &str) -> bool {
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

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionExplicitPairDto {
    pub before_text: String,
    pub after_text: String,
}

/// Tauri IPC：前端仍传 learn baseline；保存路径已不再消费 diff 推断。
#[allow(dead_code)]
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionLearnBaselineTextDto {
    pub uid: String,
    pub text: String,
}

#[derive(Debug, Clone, Default)]
pub struct SaveSegmentsLearnOpts {
    pub explicit_pairs: Vec<(String, String)>,
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

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionRuleRow {
    pub wrong: String,
    pub right: String,
    pub hit_count: i32,
    pub accepted_as_rule: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryLearnPromptRow {
    pub after_text: String,
    pub hit_count: i32,
    pub sample_before: String,
}

fn glossary_contains_term(conn: &Connection, term: &str) -> Result<bool, String> {
    let needle = term.trim();
    if needle.is_empty() {
        return Ok(true);
    }
    let mut stmt = conn
        .prepare("SELECT term, aliases FROM glossary_terms WHERE trim(term) != ''")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (term, aliases) = row.map_err(|e| e.to_string())?;
        if term.trim() == needle {
            return Ok(true);
        }
        for part in aliases.split(|c: char| c == ',' || c == '，' || c == ';' || c == '；') {
            if part.trim() == needle {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

const CORRECTION_MEMORY_LIST_LIMIT: usize = 200;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionMemoryEntryRow {
    pub wrong: String,
    pub right: String,
    pub hit_count: i32,
    pub accepted_as_rule: bool,
    pub updated_at_ms: i64,
    pub is_stable: bool,
}

pub fn delete_correction_memory_entry(
    conn: &Connection,
    wrong: &str,
    right: &str,
) -> Result<(), String> {
    let wrong = wrong.trim();
    let right = right.trim();
    if wrong.is_empty() || right.is_empty() {
        return Err("请选择要删除的纠错记忆。".to_string());
    }
    let n = conn
        .execute(
            "DELETE FROM correction_memory WHERE before_text = ?1 AND after_text = ?2",
            params![wrong, right],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("未找到该条纠错记忆。".to_string());
    }
    Ok(())
}

/// Manual create/update from 热词与记忆 UI. Renaming wrong/right deletes the old key first.
pub fn save_correction_memory_entry(
    conn: &Connection,
    wrong: &str,
    right: &str,
    accepted_as_rule: bool,
    replace_wrong: Option<&str>,
    replace_right: Option<&str>,
) -> Result<(), String> {
    let wrong = wrong.trim();
    let right = right.trim();
    if wrong.is_empty() || right.is_empty() || wrong == right {
        return Err("错词与正词均不能为空，且不能相同。".to_string());
    }
    if let (Some(ow), Some(or)) = (replace_wrong, replace_right) {
        let ow = ow.trim();
        let or = or.trim();
        if !ow.is_empty() && !or.is_empty() && (ow != wrong || or != right) {
            let _ = conn.execute(
                "DELETE FROM correction_memory WHERE before_text = ?1 AND after_text = ?2",
                params![ow, or],
            );
        }
    }
    let at_ms = now_ms();
    let accepted = if accepted_as_rule { 1 } else { 0 };
    conn.execute(
        "INSERT INTO correction_memory \
         (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms)\
         VALUES (?1, ?2, 1, ?3, ?4, ?4)\
         ON CONFLICT(before_text, after_text) DO UPDATE SET \
         accepted_as_rule = excluded.accepted_as_rule, updated_at_ms = excluded.updated_at_ms",
        params![wrong, right, accepted, at_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_correction_memory_entries(
    conn: &Connection,
) -> Result<Vec<CorrectionMemoryEntryRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text, hit_count, accepted_as_rule, updated_at_ms \
             FROM correction_memory \
             ORDER BY updated_at_ms DESC \
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![CORRECTION_MEMORY_LIST_LIMIT as i64], |r| {
            let wrong: String = r.get(0)?;
            let right: String = r.get(1)?;
            let hit_count: i32 = r.get(2)?;
            let accepted_as_rule: i32 = r.get(3)?;
            let updated_at_ms: i64 = r.get(4)?;
            let accepted = accepted_as_rule != 0;
            Ok(CorrectionMemoryEntryRow {
                wrong,
                right,
                hit_count,
                accepted_as_rule: accepted,
                updated_at_ms,
                is_stable: accepted || hit_count >= 2,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        let wrong = row.wrong.trim().to_string();
        let right = row.right.trim().to_string();
        if wrong.is_empty() || right.is_empty() || wrong == right {
            continue;
        }
        out.push(CorrectionMemoryEntryRow {
            wrong,
            right,
            hit_count: row.hit_count,
            accepted_as_rule: row.accepted_as_rule,
            updated_at_ms: row.updated_at_ms,
            is_stable: row.is_stable,
        });
    }
    Ok(out)
}

pub fn list_stable_correction_rules(conn: &Connection) -> Result<Vec<CorrectionRuleRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text, hit_count, accepted_as_rule FROM correction_memory \
             WHERE accepted_as_rule = 1 OR hit_count >= 2 \
             ORDER BY length(before_text) DESC, accepted_as_rule DESC, hit_count DESC, updated_at_ms DESC \
             LIMIT 80",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CorrectionRuleRow {
                wrong: r.get(0)?,
                right: r.get(1)?,
                hit_count: r.get(2)?,
                accepted_as_rule: r.get::<_, i32>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        let wrong = row.wrong.trim().to_string();
        let right = row.right.trim().to_string();
        if wrong.is_empty() || right.is_empty() || wrong == right {
            continue;
        }
        out.push(CorrectionRuleRow {
            wrong,
            right,
            hit_count: row.hit_count,
            accepted_as_rule: row.accepted_as_rule,
        });
    }
    Ok(out)
}

/// LEX-MINE-1: stable memory (hit≥2 or accepted) whose canonical「正词」is not yet in glossary.
pub fn list_glossary_mine_candidates(conn: &Connection) -> Result<Vec<GlossaryLearnPromptRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT after_text, MAX(hit_count) AS max_hit, MIN(before_text) AS sample_before \
             FROM correction_memory \
             WHERE trim(after_text) != '' AND (accepted_as_rule = 1 OR hit_count >= 2) \
             GROUP BY after_text \
             ORDER BY MAX(accepted_as_rule) DESC, max_hit DESC, after_text ASC \
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i32>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (after_text, hit_count, sample_before) = row.map_err(|e| e.to_string())?;
        let after_text = after_text.trim().to_string();
        if after_text.is_empty() || glossary_contains_term(conn, &after_text)? {
            continue;
        }
        out.push(GlossaryLearnPromptRow {
            after_text,
            hit_count,
            sample_before: sample_before.trim().to_string(),
        });
    }
    Ok(out)
}

pub fn list_glossary_learn_prompts(conn: &Connection) -> Result<Vec<GlossaryLearnPromptRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT after_text, MAX(hit_count) AS max_hit, MIN(before_text) AS sample_before \
             FROM correction_memory \
             WHERE hit_count >= 3 AND trim(after_text) != '' \
             GROUP BY after_text \
             ORDER BY max_hit DESC, after_text ASC \
             LIMIT 8",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i32>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let (after_text, hit_count, sample_before) = row.map_err(|e| e.to_string())?;
        let after_text = after_text.trim().to_string();
        if after_text.is_empty() || glossary_contains_term(conn, &after_text)? {
            continue;
        }
        out.push(GlossaryLearnPromptRow {
            after_text,
            hit_count,
            sample_before: sample_before.trim().to_string(),
        });
    }
    Ok(out)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_learn_rejects_isolated_single_cjk_char_pair() {
        assert!(!should_learn_inferred_replacement("盈", "凌"));
        assert!(!should_learn_inferred_replacement("其", "七"));
        assert!(should_learn_inferred_replacement("山通", "禅宗"));
        assert!(should_learn_inferred_replacement("错误", "正确"));
    }

    #[test]
    fn should_learn_inferred_replacement_rejects_long_span() {
        assert!(!should_learn_inferred_replacement(
            "因为我们不是以修订为主",
            "允许你们挂座"
        ));
    }

    #[test]
    fn should_learn_inferred_replacement_rejects_pinyin_buffer() {
        assert!(!should_learn_inferred_replacement("脸喉", "lian"));
        assert!(!should_learn_inferred_replacement("lian", "敛喉"));
        assert!(!should_learn_inferred_replacement("lian", "lianhou"));
    }

    #[test]
    fn should_learn_strips_punctuation_and_whitespace() {
        assert!(should_learn_inferred_replacement("视死，", "誓死，"));
        assert!(should_learn_inferred_replacement("视死", "誓死，"));
        assert!(!should_learn_inferred_replacement("，", "。"));
        assert_eq!(
            normalize_correction_learn_pair(" 视死 ", " 誓死 ").unwrap(),
            ("视死".to_string(), "誓死".to_string())
        );
    }

    #[test]
    fn save_correction_memory_entry_renames_key() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE correction_memory (
                before_text TEXT NOT NULL,
                after_text TEXT NOT NULL,
                hit_count INTEGER NOT NULL,
                accepted_as_rule INTEGER NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL,
                PRIMARY KEY (before_text, after_text)
            );",
        )
        .unwrap();
        save_correction_memory_entry(&conn, "旧错", "旧对", false, None, None).unwrap();
        save_correction_memory_entry(
            &conn,
            "新错",
            "新对",
            true,
            Some("旧错"),
            Some("旧对"),
        )
        .unwrap();
        let n: i32 = conn
            .query_row("SELECT COUNT(*) FROM correction_memory", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
        let accepted: i32 = conn
            .query_row(
                "SELECT accepted_as_rule FROM correction_memory WHERE before_text = '新错'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(accepted, 1);
    }

    #[test]
    fn list_glossary_mine_candidates_excludes_terms_in_glossary() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE correction_memory (
                before_text TEXT NOT NULL,
                after_text TEXT NOT NULL,
                hit_count INTEGER NOT NULL,
                accepted_as_rule INTEGER NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL,
                PRIMARY KEY (before_text, after_text)
            );
            CREATE TABLE glossary_terms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term TEXT NOT NULL,
                aliases TEXT NOT NULL DEFAULT '',
                domain TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL,
                hotword_enabled INTEGER NOT NULL DEFAULT 1
            );",
        )
        .unwrap();
        save_correction_memory_entry(&conn, "错A", "对A", false, None, None).unwrap();
        conn.execute(
            "UPDATE correction_memory SET hit_count = 2 WHERE before_text = '错A'",
            [],
        )
        .unwrap();
        save_correction_memory_entry(&conn, "错B", "已有", false, None, None).unwrap();
        conn.execute(
            "UPDATE correction_memory SET hit_count = 3 WHERE before_text = '错B'",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, created_at_ms, updated_at_ms, hotword_enabled) \
             VALUES ('已有', '', '', '', 1, 1, 1)",
            [],
        )
        .unwrap();
        let rows = list_glossary_mine_candidates(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].after_text, "对A");
    }

    #[test]
    fn delete_correction_memory_entry_removes_row() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE correction_memory (
                before_text TEXT NOT NULL,
                after_text TEXT NOT NULL,
                hit_count INTEGER NOT NULL,
                accepted_as_rule INTEGER NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL,
                PRIMARY KEY (before_text, after_text)
            );",
        )
        .unwrap();
        save_correction_memory_entry(&conn, "a", "b", false, None, None).unwrap();
        delete_correction_memory_entry(&conn, "a", "b").unwrap();
        let n: i32 = conn
            .query_row("SELECT COUNT(*) FROM correction_memory", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn upsert_explicit_correction_pairs_inserts_row() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE correction_memory (
                before_text TEXT NOT NULL,
                after_text TEXT NOT NULL,
                hit_count INTEGER NOT NULL,
                accepted_as_rule INTEGER NOT NULL,
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL,
                PRIMARY KEY (before_text, after_text)
            );",
        )
        .unwrap();
        upsert_explicit_correction_pairs(&conn, &[("山通".into(), "禅宗".into())], 1).unwrap();
        let hit: i32 = conn
            .query_row(
                "SELECT hit_count FROM correction_memory WHERE before_text = '山通'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hit, 1);
    }
}

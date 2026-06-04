//! Glossary → ASR `hotwords` string (≤12k **Unicode characters**, aligned with Python `len(str)`).

use super::glossary_aliases::hotword_tokens_for_entry;
use super::hotword_guard::{
    load_correction_before_text_blocklist, token_is_correction_before_text,
};
use rusqlite::Connection;
use std::collections::HashSet;

pub const HOTWORDS_MAX_CHARS: usize = 12_000;

#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryHotwordsPreview {
    /// Glossary rows with `hotword_enabled = 1`.
    pub enabled_entry_count: usize,
    /// Unique hotword tokens (primary + aliases, globally deduped).
    pub term_count: usize,
    pub included_term_count: usize,
    pub dropped_term_count: usize,
    pub joined_char_count: usize,
    pub submitted_char_count: usize,
    pub max_chars: usize,
    pub truncated: bool,
    pub preview: String,
}

#[derive(Debug, Clone)]
pub struct GlossaryHotwordsBuild {
    pub hotwords: String,
    pub preview: GlossaryHotwordsPreview,
}

fn char_len(s: &str) -> usize {
    s.chars().count()
}

pub fn truncate_hotwords_to_char_limit(s: &str, max_chars: usize) -> String {
    if char_len(s) <= max_chars {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max_chars).collect();
    // rfind returns byte index; compare character counts to avoid UTF-8 skew
    if let Some(byte_idx) = out.rfind(' ') {
        let chars_before = out[..byte_idx].chars().count();
        if chars_before > max_chars / 2 {
            out.truncate(byte_idx);
        }
    }
    out
}

fn preview_text(hotwords: &str) -> String {
    const PREVIEW_MAX: usize = 240;
    if char_len(hotwords) <= PREVIEW_MAX {
        return hotwords.to_string();
    }
    let mut out: String = hotwords.chars().take(PREVIEW_MAX).collect();
    out.push('…');
    out
}

fn try_append_term(hotwords: &mut String, term: &str) -> bool {
    let term_chars = char_len(term);
    if term_chars == 0 {
        return false;
    }
    let current = char_len(hotwords);
    if hotwords.is_empty() {
        if term_chars > HOTWORDS_MAX_CHARS {
            *hotwords = truncate_hotwords_to_char_limit(term, HOTWORDS_MAX_CHARS);
            return true;
        }
        hotwords.push_str(term);
        return true;
    }
    let add = 1 + term_chars;
    if current + add > HOTWORDS_MAX_CHARS {
        return false;
    }
    hotwords.push(' ');
    hotwords.push_str(term);
    true
}

fn enabled_entry_count(conn: &Connection) -> Result<usize, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM glossary_terms WHERE hotword_enabled = 1",
        [],
        |r| r.get::<_, i64>(0),
    )
    .map(|n| n.max(0) as usize)
    .map_err(|e| e.to_string())
}

pub fn build_glossary_hotwords(conn: &Connection) -> Result<GlossaryHotwordsBuild, String> {
    let before_text_blocklist = load_correction_before_text_blocklist(conn)?;
    let enabled_entries = enabled_entry_count(conn)?;
    let mut stmt = conn
        .prepare(
            "SELECT term, aliases FROM glossary_terms WHERE hotword_enabled = 1 \
             ORDER BY COALESCE(updated_at_ms, created_at_ms) DESC, term COLLATE NOCASE ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;

    let mut seen_tokens: HashSet<String> = HashSet::new();
    let mut unique_tokens: Vec<String> = Vec::new();

    for r in rows {
        let (term, aliases) = r.map_err(|e| e.to_string())?;
        for token in hotword_tokens_for_entry(&term, &aliases) {
            if token_is_correction_before_text(&token, &before_text_blocklist) {
                continue;
            }
            let key = token.to_lowercase();
            if seen_tokens.insert(key) {
                unique_tokens.push(token);
            }
        }
    }

    let term_count = unique_tokens.len();
    let mut joined_char_count = 0usize;
    for (i, token) in unique_tokens.iter().enumerate() {
        if i > 0 {
            joined_char_count += 1;
        }
        joined_char_count += char_len(token);
    }

    let mut hotwords = String::new();
    let mut included_term_count = 0usize;
    for token in &unique_tokens {
        if try_append_term(&mut hotwords, token) {
            included_term_count += 1;
        }
    }

    let truncated = joined_char_count > HOTWORDS_MAX_CHARS;
    let dropped_term_count = term_count.saturating_sub(included_term_count);
    Ok(GlossaryHotwordsBuild {
        hotwords: hotwords.clone(),
        preview: GlossaryHotwordsPreview {
            enabled_entry_count: enabled_entries,
            term_count,
            included_term_count,
            dropped_term_count,
            joined_char_count,
            submitted_char_count: char_len(&hotwords),
            max_chars: HOTWORDS_MAX_CHARS,
            truncated,
            preview: preview_text(&hotwords),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn joined_char_count_for_terms(parts: &[String]) -> usize {
        let mut n = 0usize;
        for (i, p) in parts.iter().enumerate() {
            if i > 0 {
                n += 1;
            }
            n += char_len(p);
        }
        n
    }

    fn assemble_hotwords_from_parts(parts: &[String]) -> (String, usize) {
        let mut hotwords = String::new();
        let mut included_term_count = 0usize;
        for part in parts {
            if try_append_term(&mut hotwords, part) {
                included_term_count += 1;
            }
        }
        (hotwords, included_term_count)
    }

    fn build_glossary_hotwords_from_terms(parts: Vec<String>) -> GlossaryHotwordsBuild {
        let term_count = parts.len();
        let joined_char_count = joined_char_count_for_terms(&parts);
        let truncated = joined_char_count > HOTWORDS_MAX_CHARS;
        let (hotwords, included_term_count) = assemble_hotwords_from_parts(&parts);
        let dropped_term_count = term_count.saturating_sub(included_term_count);
        GlossaryHotwordsBuild {
            hotwords: hotwords.clone(),
            preview: GlossaryHotwordsPreview {
                enabled_entry_count: term_count,
                term_count,
                included_term_count,
                dropped_term_count,
                joined_char_count,
                submitted_char_count: char_len(&hotwords),
                max_chars: HOTWORDS_MAX_CHARS,
                truncated,
                preview: preview_text(&hotwords),
            },
        }
    }

    #[test]
    fn chinese_counts_characters_not_bytes() {
        let build = build_glossary_hotwords_from_terms(vec!["三乘".into(), "主任".into()]);
        assert_eq!(build.preview.submitted_char_count, 5);
        assert_eq!(build.hotwords, "三乘 主任");
    }

    #[test]
    fn skips_middle_term_that_exceeds_remaining_budget() {
        let parts = vec!["三乘".into(), "中".repeat(12_000), "主任".into()];
        let build = build_glossary_hotwords_from_terms(parts);
        assert_eq!(build.preview.included_term_count, 2);
        assert!(build.hotwords.contains("主任"));
        assert!(!build.hotwords.contains("中"));
    }

    #[test]
    fn truncate_at_word_boundary_when_possible() {
        let parts: Vec<String> = (0..1200)
            .map(|i| format!("glossary-entry-{i}-padding"))
            .collect();
        let build = build_glossary_hotwords_from_terms(parts);
        assert!(build.preview.truncated);
        assert!(build.preview.submitted_char_count <= HOTWORDS_MAX_CHARS);
        assert!(build.preview.dropped_term_count > 0);
    }

    #[test]
    fn empty_glossary_yields_zero_counts() {
        let build = build_glossary_hotwords_from_terms(vec![]);
        assert!(!build.preview.truncated);
        assert_eq!(build.preview.term_count, 0);
        assert!(build.hotwords.is_empty());
    }

    #[test]
    fn db_load_includes_alias_tokens() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES (?1, ?2, '', '', 1, 1, 1)",
            rusqlite::params!["三乘", "主任"],
        )
        .unwrap();
        let build = build_glossary_hotwords(&conn).unwrap();
        assert_eq!(build.hotwords, "三乘 主任");
        assert_eq!(build.preview.term_count, 2);
        assert_eq!(build.preview.enabled_entry_count, 1);
    }

    #[test]
    fn db_skips_hotword_disabled_entries() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES (?1, ?2, '', '', 1, 1, 1)",
            rusqlite::params!["三乘", "主任"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES (?1, '', '', '', 0, 1, 1)",
            rusqlite::params!["学记"],
        )
        .unwrap();
        let build = build_glossary_hotwords(&conn).unwrap();
        assert_eq!(build.hotwords, "三乘 主任");
        assert_eq!(build.preview.term_count, 2);
        assert_eq!(build.preview.enabled_entry_count, 1);
    }

    #[test]
    fn db_excludes_correction_before_text_tokens() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) \
             VALUES ('制控', '智控', '', '', 1, 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('智控', '制控', 1, 0, 1, 1)",
            [],
        )
        .unwrap();
        let build = build_glossary_hotwords(&conn).unwrap();
        assert_eq!(build.hotwords, "制控");
        assert_eq!(build.preview.term_count, 1);
    }

    #[test]
    fn db_orders_entries_by_updated_at_ms_desc() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) \
             VALUES ('旧词', '', '', '', 1, 1, 1000)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) \
             VALUES ('新词', '', '', '', 1, 2, 2000)",
            [],
        )
        .unwrap();
        let build = build_glossary_hotwords(&conn).unwrap();
        assert!(
            build.hotwords.starts_with("新词"),
            "expected newer term first, got: {}",
            build.hotwords
        );
        let plan = crate::project::stt_vocabulary::SttVocabularyPlan::from_build(&build);
        let prompt = crate::project::stt_vocabulary::openai_prompt(&plan).expect("prompt");
        assert!(prompt.starts_with("新词"));
    }

    #[test]
    fn db_dedupes_tokens_across_entries() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES ('三乘', '', '', '', 1, 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) VALUES ('主任', '三乘', '', '', 1, 2, 2)",
            [],
        )
        .unwrap();
        let build = build_glossary_hotwords(&conn).unwrap();
        // `主任` row has newer updated_at_ms → listed before `三乘` (dedupe keeps first-seen token order per entry pass).
        assert_eq!(build.hotwords, "主任 三乘");
        assert_eq!(build.preview.term_count, 2);
    }
}

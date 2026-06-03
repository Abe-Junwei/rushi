//! ASR-VOC-GUARD (Q-ACC-8): correction_memory `before_text` must not enter hotwords or glossary.

use super::glossary_aliases::hotword_tokens_for_entry;
use rusqlite::{params, Connection};
use std::collections::HashSet;

/// Lowercased trim of every non-empty `correction_memory.before_text`.
pub fn load_correction_before_text_blocklist(conn: &Connection) -> Result<HashSet<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT trim(before_text) FROM correction_memory WHERE trim(before_text) != ''",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut out = HashSet::new();
    for row in rows {
        let text = row.map_err(|e| e.to_string())?;
        let key = text.trim().to_lowercase();
        if !key.is_empty() {
            out.insert(key);
        }
    }
    Ok(out)
}

pub fn token_is_correction_before_text(token: &str, blocklist: &HashSet<String>) -> bool {
    let key = token.trim().to_lowercase();
    !key.is_empty() && blocklist.contains(&key)
}

/// Prefer highest-hit `after_text` when the same wrong form was learned multiple times.
pub fn suggested_after_text_for_before(conn: &Connection, before: &str) -> Option<String> {
    let before = before.trim();
    if before.is_empty() {
        return None;
    }
    conn.query_row(
        "SELECT after_text FROM correction_memory \
         WHERE trim(before_text) = trim(?1) AND trim(after_text) != '' \
         ORDER BY hit_count DESC, updated_at_ms DESC LIMIT 1",
        params![before],
        |r| r.get::<_, String>(0),
    )
    .ok()
    .filter(|s| !s.trim().is_empty())
}

/// Reject glossary term/alias tokens that match a learned wrong form (`before_text`).
pub fn reject_glossary_correction_before_texts(
    conn: &Connection,
    term: &str,
    aliases: &str,
) -> Result<(), String> {
    let blocklist = load_correction_before_text_blocklist(conn)?;
    if blocklist.is_empty() {
        return Ok(());
    }
    for token in hotword_tokens_for_entry(term, aliases) {
        if !token_is_correction_before_text(&token, &blocklist) {
            continue;
        }
        let hint = suggested_after_text_for_before(conn, &token)
            .map(|after| format!("请使用正形「{after}」作为主术语。"))
            .unwrap_or_else(|| "请填写纠错记忆中的正形，勿将 ASR 错形写入术语表。".to_string());
        return Err(format!(
            "「{token}」是纠错记忆中的错形，不能写入转写词汇表。{hint}"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocklist_excludes_matching_tokens() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('智控', '制控', 1, 0, 1, 1)",
            [],
        )
        .unwrap();
        let blocklist = load_correction_before_text_blocklist(&conn).unwrap();
        assert!(token_is_correction_before_text("智控", &blocklist));
        assert!(token_is_correction_before_text(" 智控 ", &blocklist));
        assert!(!token_is_correction_before_text("制控", &blocklist));
    }

    #[test]
    fn reject_glossary_add_when_term_is_correction_before_text() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('闪法', '战法', 1, 0, 1, 1)",
            [],
        )
        .unwrap();
        let err = reject_glossary_correction_before_texts(&conn, "闪法", "").unwrap_err();
        assert!(err.contains("闪法"));
        assert!(err.contains("战法"));
        assert!(reject_glossary_correction_before_texts(&conn, "战法", "闪法").is_err());
        assert!(reject_glossary_correction_before_texts(&conn, "战法", "").is_ok());
    }
}

use super::correction_types::{GlossaryLearnPromptRow, CORRECTION_MEMORY_STABLE_HIT};
use crate::project::hotword_guard::reject_glossary_correction_before_texts;
use crate::project::types::SegmentDto;
use rusqlite::{params, Connection};
use std::collections::HashSet;

const CORRECTION_RULE_WARNING_PREFIX: &str = "correction_rule_hint:";

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
        for part in aliases.split([',', '，', ';', '；']) {
            if part.trim() == needle {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

/// hit≥阈值且术语库尚无该正形时自动写入 glossary（Descript 式满 3 次进表，无弹窗）。
pub fn maybe_auto_add_glossary_for_memory_hit(
    conn: &Connection,
    after_text: &str,
    _sample_before: &str,
    hit_count: i32,
    at_ms: i64,
) -> Result<bool, String> {
    if hit_count < CORRECTION_MEMORY_STABLE_HIT {
        return Ok(false);
    }
    let after_text = after_text.trim();
    if after_text.is_empty() || glossary_contains_term(conn, after_text)? {
        return Ok(false);
    }
    // 错形不得进热词/术语别名（ASR-VOC-GUARD）；仅写入正形 term。
    let aliases = "";
    reject_glossary_correction_before_texts(conn, after_text, aliases)?;
    let note = format!("纠错记忆 {hit_count} 次命中后自动加入");
    let inserted = conn
        .execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, '', ?3, 1, ?4, ?4)",
            params![after_text, aliases, note, at_ms],
        )
        .map_err(|e| e.to_string())?;
    Ok(inserted > 0)
}

/// LEX-MINE-1: stable memory (hit≥阈值 or accepted) whose canonical「正词」is not yet in glossary.
pub fn list_glossary_mine_candidates(
    conn: &Connection,
) -> Result<Vec<GlossaryLearnPromptRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT after_text, MAX(hit_count) AS max_hit, MIN(before_text) AS sample_before \
             FROM correction_memory \
             WHERE trim(after_text) != '' AND (accepted_as_rule = 1 OR hit_count >= ?1) \
             GROUP BY after_text \
             ORDER BY MAX(accepted_as_rule) DESC, max_hit DESC, after_text ASC \
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![CORRECTION_MEMORY_STABLE_HIT], |r| {
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

pub fn list_glossary_learn_prompts(
    conn: &Connection,
) -> Result<Vec<GlossaryLearnPromptRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT after_text, MAX(hit_count) AS max_hit, MIN(before_text) AS sample_before \
             FROM correction_memory \
             WHERE hit_count >= ?1 AND trim(after_text) != '' \
             GROUP BY after_text \
             ORDER BY max_hit DESC, after_text ASC \
             LIMIT 8",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![CORRECTION_MEMORY_STABLE_HIT], |r| {
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
             WHERE accepted_as_rule = 1 OR hit_count >= ?1 \
             ORDER BY accepted_as_rule DESC, hit_count DESC, updated_at_ms DESC \
             LIMIT 40",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![CORRECTION_MEMORY_STABLE_HIT], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })
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

use super::correction_types::GlossaryLearnPromptRow;
use crate::project::types::SegmentDto;
use rusqlite::Connection;
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

/// LEX-MINE-1: stable memory (hit≥2 or accepted) whose canonical「正词」is not yet in glossary.
pub fn list_glossary_mine_candidates(
    conn: &Connection,
) -> Result<Vec<GlossaryLearnPromptRow>, String> {
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

pub fn list_glossary_learn_prompts(
    conn: &Connection,
) -> Result<Vec<GlossaryLearnPromptRow>, String> {
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

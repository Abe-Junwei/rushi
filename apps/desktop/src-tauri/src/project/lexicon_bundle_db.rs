use super::lexicon_bundle_types::{
    LexiconBundleCorrectionRule, LexiconBundleGlossaryTerm, LocalGlossaryRow, LocalRuleRow,
};
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};

pub(crate) enum RuleCompare {
    BundleWins,
    LocalWins,
    Tie,
}

pub(crate) fn compare_rule_strength(a: &LocalRuleRow, b: &LocalRuleRow) -> std::cmp::Ordering {
    compare_rule_strength_tuple(
        (a.hit_count, a.accepted_as_rule, a.updated_at_ms),
        (b.hit_count, b.accepted_as_rule, b.updated_at_ms),
    )
}

fn compare_rule_strength_tuple(
    a: (i32, bool, i64),
    b: (i32, bool, i64),
) -> std::cmp::Ordering {
    a.0.cmp(&b.0)
        .then_with(|| a.1.cmp(&b.1))
        .then_with(|| a.2.cmp(&b.2))
}

pub(crate) fn compare_rule_pair(
    local: &LocalRuleRow,
    bundle: &LexiconBundleCorrectionRule,
) -> RuleCompare {
    let l = (
        local.hit_count,
        local.accepted_as_rule,
        local.updated_at_ms,
    );
    let b = (
        bundle.hit_count,
        bundle.accepted_as_rule,
        bundle.updated_at_ms,
    );
    match compare_rule_strength_tuple(l, b) {
        std::cmp::Ordering::Less => RuleCompare::BundleWins,
        std::cmp::Ordering::Greater => RuleCompare::LocalWins,
        std::cmp::Ordering::Equal => RuleCompare::Tie,
    }
}

pub(crate) fn glossary_key(term: &str) -> String {
    term.trim().to_lowercase()
}

pub(crate) fn glossary_rows_compatible(
    local: &LocalGlossaryRow,
    bundle: &LexiconBundleGlossaryTerm,
) -> bool {
    local.aliases.trim() == bundle.aliases.trim()
        && local.domain.trim() == bundle.domain.trim()
        && local.note.trim() == bundle.note.trim()
        && local.hotword_enabled == bundle.hotword_enabled
}

pub(crate) fn merge_alias_strings(a: &str, b: &str) -> String {
    let mut seen = HashSet::new();
    let mut parts = Vec::new();
    for piece in a
        .split([',', '，', ';', '；'])
        .chain(b.split([',', '，', ';', '；']))
    {
        let t = piece.trim();
        if t.is_empty() {
            continue;
        }
        let key = t.to_lowercase();
        if seen.insert(key) {
            parts.push(t.to_string());
        }
    }
    parts.join("，")
}

pub(crate) fn dedupe_bundle_rules(
    rules: Vec<LexiconBundleCorrectionRule>,
) -> Vec<LexiconBundleCorrectionRule> {
    let mut by_before: HashMap<String, LexiconBundleCorrectionRule> = HashMap::new();
    for rule in rules {
        let before = rule.before_text.trim().to_string();
        let after = rule.after_text.trim().to_string();
        if before.is_empty() || after.is_empty() || before == after {
            continue;
        }
        let normalized = LexiconBundleCorrectionRule {
            before_text: before.clone(),
            after_text: after,
            hit_count: rule.hit_count.max(0),
            accepted_as_rule: rule.accepted_as_rule,
            updated_at_ms: rule.updated_at_ms,
        };
        match by_before.get(&before) {
            None => {
                by_before.insert(before, normalized);
            }
            Some(existing) => {
                if compare_rule_strength_tuple(
                    (
                        normalized.hit_count,
                        normalized.accepted_as_rule,
                        normalized.updated_at_ms,
                    ),
                    (
                        existing.hit_count,
                        existing.accepted_as_rule,
                        existing.updated_at_ms,
                    ),
                ) == std::cmp::Ordering::Greater
                {
                    by_before.insert(before, normalized);
                }
            }
        }
    }
    let mut out: Vec<_> = by_before.into_values().collect();
    out.sort_by(|a, b| a.before_text.cmp(&b.before_text));
    out
}

pub(crate) fn load_glossary_for_export(
    conn: &Connection,
) -> Result<Vec<LexiconBundleGlossaryTerm>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT term, aliases, domain, note, hotword_enabled FROM glossary_terms ORDER BY term COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(LexiconBundleGlossaryTerm {
                term: r.get(0)?,
                aliases: r.get(1)?,
                domain: r.get(2)?,
                note: r.get(3)?,
                hotword_enabled: r.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        if row.term.trim().is_empty() {
            continue;
        }
        out.push(row);
    }
    Ok(out)
}

pub(crate) fn load_rules_for_export(
    conn: &Connection,
    stable_only: bool,
) -> Result<Vec<LexiconBundleCorrectionRule>, String> {
    let sql = if stable_only {
        "SELECT before_text, after_text, hit_count, accepted_as_rule, updated_at_ms \
         FROM correction_memory \
         WHERE accepted_as_rule = 1 OR hit_count >= 2 \
         ORDER BY updated_at_ms DESC"
    } else {
        "SELECT before_text, after_text, hit_count, accepted_as_rule, updated_at_ms \
         FROM correction_memory \
         ORDER BY updated_at_ms DESC"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(LexiconBundleCorrectionRule {
                before_text: r.get(0)?,
                after_text: r.get(1)?,
                hit_count: r.get(2)?,
                accepted_as_rule: r.get::<_, i32>(3)? != 0,
                updated_at_ms: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    for row in rows {
        raw.push(row.map_err(|e| e.to_string())?);
    }
    Ok(dedupe_bundle_rules(raw))
}

pub(crate) fn load_local_glossary_map(
    conn: &Connection,
) -> Result<HashMap<String, LocalGlossaryRow>, String> {
    let mut stmt = conn
        .prepare("SELECT term, aliases, domain, note, hotword_enabled FROM glossary_terms")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(LocalGlossaryRow {
                term: r.get(0)?,
                aliases: r.get(1)?,
                domain: r.get(2)?,
                note: r.get(3)?,
                hotword_enabled: r.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = HashMap::new();
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        let key = glossary_key(&row.term);
        if key.is_empty() {
            continue;
        }
        out.insert(key, row);
    }
    Ok(out)
}

pub(crate) fn load_local_rules(conn: &Connection) -> Result<Vec<LocalRuleRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text, hit_count, accepted_as_rule, updated_at_ms \
             FROM correction_memory",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(LocalRuleRow {
                before_text: r.get(0)?,
                after_text: r.get(1)?,
                hit_count: r.get(2)?,
                accepted_as_rule: r.get::<_, i32>(3)? != 0,
                updated_at_ms: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        let before = row.before_text.trim().to_string();
        let after = row.after_text.trim().to_string();
        if before.is_empty() || after.is_empty() || before == after {
            continue;
        }
        out.push(LocalRuleRow {
            before_text: before,
            after_text: after,
            ..row
        });
    }
    Ok(out)
}

pub(crate) fn insert_glossary_row(
    conn: &Connection,
    term: &str,
    row: &LexiconBundleGlossaryTerm,
    at_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            term,
            row.aliases.trim(),
            row.domain.trim(),
            row.note.trim(),
            i64::from(row.hotword_enabled),
            at_ms
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn apply_glossary_bundle_row(
    conn: &Connection,
    term: &str,
    row: &LexiconBundleGlossaryTerm,
    at_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE glossary_terms SET aliases = ?1, domain = ?2, note = ?3, hotword_enabled = ?4, updated_at_ms = ?5 \
         WHERE lower(trim(term)) = lower(trim(?6))",
        params![
            row.aliases.trim(),
            row.domain.trim(),
            row.note.trim(),
            i64::from(row.hotword_enabled),
            at_ms,
            term
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn insert_rule_row(
    conn: &Connection,
    before: &str,
    after: &str,
    rule: &LexiconBundleCorrectionRule,
    at_ms: i64,
) -> Result<(), String> {
    let hit = rule.hit_count.max(1);
    let accepted = i64::from(rule.accepted_as_rule);
    conn.execute(
        "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![before, after, hit, accepted, at_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn merge_rule_pair(
    conn: &Connection,
    before: &str,
    after: &str,
    rule: &LexiconBundleCorrectionRule,
    at_ms: i64,
) -> Result<(), String> {
    let hit = rule.hit_count.max(1);
    let accepted = i64::from(rule.accepted_as_rule);
    conn.execute(
        "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?5) \
         ON CONFLICT(before_text, after_text) DO UPDATE SET \
           hit_count = MAX(hit_count, excluded.hit_count), \
           accepted_as_rule = MAX(accepted_as_rule, excluded.accepted_as_rule), \
           updated_at_ms = MAX(updated_at_ms, excluded.updated_at_ms)",
        params![before, after, hit, accepted, at_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) fn replace_rules_for_before(
    conn: &Connection,
    before: &str,
    rule: &LexiconBundleCorrectionRule,
    at_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM correction_memory WHERE before_text = ?1",
        params![before],
    )
    .map_err(|e| e.to_string())?;
    let after = rule.after_text.trim();
    insert_rule_row(conn, before, after, rule, at_ms)
}

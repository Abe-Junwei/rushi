use crate::project::hotword_guard::reject_glossary_correction_before_texts;
use crate::project::utils::now_ms;
use super::lexicon_bundle_db::{
    apply_glossary_bundle_row, compare_rule_pair, compare_rule_strength, dedupe_bundle_rules,
    glossary_key, glossary_rows_compatible, insert_glossary_row, insert_rule_row,
    load_local_glossary_map, load_local_rules, merge_alias_strings, merge_rule_pair,
    replace_rules_for_before, RuleCompare,
};
use super::lexicon_bundle_types::{
    LexiconBundleConflict, LexiconBundleConflictResolution, LexiconBundleDocument,
    LexiconBundleImportApplyResult, LexiconBundleImportPreview,
};
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};

use super::validate_lexicon_bundle;

pub fn preview_lexicon_bundle_import(
    conn: &Connection,
    doc: &LexiconBundleDocument,
) -> Result<LexiconBundleImportPreview, String> {
    validate_lexicon_bundle(doc)?;
    let local_glossary = load_local_glossary_map(conn)?;
    let local_rules = load_local_rules(conn)?;
    let bundle_rules = dedupe_bundle_rules(doc.correction_rules.clone());

    let mut insert_glossary = 0usize;
    let mut skip_glossary = 0usize;
    let mut insert_rules = 0usize;
    let mut skip_rules = 0usize;
    let mut auto_resolved_rules = 0usize;
    let mut conflicts = Vec::new();
    let mut conflict_ids: HashSet<String> = HashSet::new();

    for term in &doc.glossary_terms {
        let t = term.term.trim();
        if t.is_empty() {
            continue;
        }
        if reject_glossary_correction_before_texts(conn, t, term.aliases.trim()).is_err() {
            skip_glossary += 1;
            continue;
        }
        let key = glossary_key(t);
        let Some(local) = local_glossary.get(&key) else {
            insert_glossary += 1;
            continue;
        };
        if glossary_rows_compatible(local, term) {
            skip_glossary += 1;
        } else {
            let id = format!("glossary:{key}");
            if conflict_ids.insert(id.clone()) {
                conflicts.push(LexiconBundleConflict {
                    id,
                    kind: "glossary".to_string(),
                    before_text: None,
                    local_after_text: None,
                    bundle_after_text: None,
                    term: Some(t.to_string()),
                    local_aliases: Some(local.aliases.clone()),
                    bundle_aliases: Some(term.aliases.trim().to_string()),
                    message: format!("术语「{t}」已存在，但别名/领域/备注或热词开关不一致。"),
                });
            }
            skip_glossary += 1;
        }
    }

    for rule in &bundle_rules {
        let before = rule.before_text.trim();
        let after = rule.after_text.trim();
        if before.is_empty() || after.is_empty() || before == after {
            continue;
        }
        if let Some(local) = local_rules
            .iter()
            .find(|r| r.before_text == before && r.after_text == after)
        {
            if local.hit_count == rule.hit_count && local.accepted_as_rule == rule.accepted_as_rule {
                skip_rules += 1;
            } else {
                skip_rules += 1;
            }
            continue;
        }
        let locals_for_before: Vec<_> = local_rules
            .iter()
            .filter(|r| r.before_text == before)
            .collect();
        if locals_for_before.is_empty() {
            insert_rules += 1;
            continue;
        }
        let local_best = locals_for_before
            .iter()
            .copied()
            .max_by(|a, b| compare_rule_strength(a, b))
            .unwrap();
        match compare_rule_pair(local_best, rule) {
            RuleCompare::BundleWins => {
                auto_resolved_rules += 1;
            }
            RuleCompare::LocalWins => {
                skip_rules += 1;
            }
            RuleCompare::Tie => {
                let id = format!("rule:{before}");
                if conflict_ids.insert(id.clone()) {
                    conflicts.push(LexiconBundleConflict {
                        id,
                        kind: "rule".to_string(),
                        before_text: Some(before.to_string()),
                        local_after_text: Some(local_best.after_text.clone()),
                        bundle_after_text: Some(after.to_string()),
                        term: None,
                        local_aliases: None,
                        bundle_aliases: None,
                        message: format!(
                            "纠错规则「{before}」本地为「{}」，包内为「{after}」，命中次数相同，需选择保留哪一侧。",
                            local_best.after_text
                        ),
                    });
                }
                skip_rules += 1;
            }
        }
    }

    Ok(LexiconBundleImportPreview {
        insert_glossary,
        skip_glossary,
        insert_rules,
        skip_rules,
        auto_resolved_rules,
        conflicts,
    })
}

pub fn apply_lexicon_bundle_import(
    conn: &mut Connection,
    doc: &LexiconBundleDocument,
    resolutions: &[LexiconBundleConflictResolution],
) -> Result<LexiconBundleImportApplyResult, String> {
    validate_lexicon_bundle(doc)?;
    let preview = preview_lexicon_bundle_import(conn, doc)?;
    let resolution_map: HashMap<String, String> = resolutions
        .iter()
        .map(|r| (r.id.clone(), r.choice.trim().to_lowercase()))
        .collect();

    for conflict in &preview.conflicts {
        if !resolution_map.contains_key(&conflict.id) {
            return Err(format!(
                "尚有 {} 项冲突未选择处理方式，请先完成预览确认。",
                preview.conflicts.len()
            ));
        }
    }

    let at_ms = now_ms();
    let mut inserted_glossary = 0usize;
    let mut skipped_glossary = 0usize;
    let mut inserted_rules = 0usize;
    let mut merged_rules = 0usize;
    let mut replaced_rules = 0usize;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let local_glossary = load_local_glossary_map(&tx)?;

    for term in &doc.glossary_terms {
        let t = term.term.trim();
        if t.is_empty() {
            continue;
        }
        if reject_glossary_correction_before_texts(&tx, t, term.aliases.trim()).is_err() {
            skipped_glossary += 1;
            continue;
        }
        let key = glossary_key(t);
        let conflict_id = format!("glossary:{key}");
        if let Some(choice) = resolution_map.get(&conflict_id) {
            match choice.as_str() {
                "local" | "keep_local" => {
                    skipped_glossary += 1;
                    continue;
                }
                "skip" => {
                    skipped_glossary += 1;
                    continue;
                }
                "merge_aliases" => {
                    if let Some(local) = local_glossary.get(&key) {
                        let merged = merge_alias_strings(&local.aliases, term.aliases.trim());
                        tx.execute(
                            "UPDATE glossary_terms SET aliases = ?1, updated_at_ms = ?2 WHERE lower(trim(term)) = lower(trim(?3))",
                            params![merged, at_ms, t],
                        )
                        .map_err(|e| e.to_string())?;
                        inserted_glossary += 1;
                    }
                    continue;
                }
                "bundle" | "use_bundle" => {
                    apply_glossary_bundle_row(&tx, t, term, at_ms)?;
                    inserted_glossary += 1;
                    continue;
                }
                _ => {
                    return Err(format!("未知的术语冲突选项：{choice}"));
                }
            }
        }
        if local_glossary.contains_key(&key) {
            skipped_glossary += 1;
            continue;
        }
        insert_glossary_row(&tx, t, term, at_ms)?;
        inserted_glossary += 1;
    }

    let bundle_rules = dedupe_bundle_rules(doc.correction_rules.clone());
    let local_rules = load_local_rules(&tx)?;

    for rule in bundle_rules {
        let before = rule.before_text.trim().to_string();
        let after = rule.after_text.trim().to_string();
        if before.is_empty() || after.is_empty() || before == after {
            continue;
        }
        let conflict_id = format!("rule:{before}");
        if let Some(choice) = resolution_map.get(&conflict_id) {
            match choice.as_str() {
                "local" | "keep_local" | "skip" => continue,
                "bundle" | "use_bundle" => {
                    replace_rules_for_before(&tx, &before, &rule, at_ms)?;
                    replaced_rules += 1;
                }
                _ => return Err(format!("未知的规则冲突选项：{choice}")),
            }
            continue;
        }

        if local_rules
            .iter()
            .any(|r| r.before_text == before && r.after_text == after)
        {
            merge_rule_pair(&tx, &before, &after, &rule, at_ms)?;
            merged_rules += 1;
            continue;
        }
        let locals_for_before: Vec<_> = local_rules
            .iter()
            .filter(|r| r.before_text == before)
            .collect();
        if locals_for_before.is_empty() {
            insert_rule_row(&tx, &before, &after, &rule, at_ms)?;
            inserted_rules += 1;
            continue;
        }
        let local_best = locals_for_before
            .iter()
            .copied()
            .max_by(|a, b| compare_rule_strength(a, b))
            .unwrap();
        match compare_rule_pair(local_best, &rule) {
            RuleCompare::BundleWins => {
                replace_rules_for_before(&tx, &before, &rule, at_ms)?;
                replaced_rules += 1;
            }
            RuleCompare::LocalWins | RuleCompare::Tie => {}
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(LexiconBundleImportApplyResult {
        inserted_glossary,
        skipped_glossary,
        inserted_rules,
        merged_rules,
        replaced_rules,
    })
}

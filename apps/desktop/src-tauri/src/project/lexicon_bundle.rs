//! F7: `rushi_lexicon_bundle.v1` export / import preview / apply (glossary + correction_memory).

use super::hotword_guard::reject_glossary_correction_before_texts;
use super::utils::now_ms;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

const BUNDLE_KIND: &str = "rushi_lexicon_bundle";
const BUNDLE_VERSION: i32 = 1;

const FORBIDDEN_TOP_LEVEL_KEYS: &[&str] = &[
    "segments",
    "segment",
    "api_key",
    "apiKey",
    "project_id",
    "file_id",
    "uids",
    "password",
    "secret",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleExportedBy {
    pub app: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optional_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexiconBundleGlossaryTerm {
    pub term: String,
    #[serde(default)]
    pub aliases: String,
    #[serde(default)]
    pub domain: String,
    #[serde(default)]
    pub note: String,
    #[serde(default = "default_hotword_enabled")]
    pub hotword_enabled: bool,
}

fn default_hotword_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexiconBundleCorrectionRule {
    pub before_text: String,
    pub after_text: String,
    pub hit_count: i32,
    pub accepted_as_rule: bool,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexiconBundleDocument {
    pub kind: String,
    pub version: i32,
    pub exported_at_ms: i64,
    pub exported_by: LexiconBundleExportedBy,
    #[serde(default)]
    pub glossary_terms: Vec<LexiconBundleGlossaryTerm>,
    #[serde(default)]
    pub correction_rules: Vec<LexiconBundleCorrectionRule>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleImportPreview {
    pub insert_glossary: usize,
    pub skip_glossary: usize,
    pub insert_rules: usize,
    pub skip_rules: usize,
    pub auto_resolved_rules: usize,
    pub conflicts: Vec<LexiconBundleConflict>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleConflict {
    pub id: String,
    pub kind: String,
    pub before_text: Option<String>,
    pub local_after_text: Option<String>,
    pub bundle_after_text: Option<String>,
    pub term: Option<String>,
    pub local_aliases: Option<String>,
    pub bundle_aliases: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleConflictResolution {
    pub id: String,
    pub choice: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleImportApplyResult {
    pub inserted_glossary: usize,
    pub skipped_glossary: usize,
    pub inserted_rules: usize,
    pub merged_rules: usize,
    pub replaced_rules: usize,
}

#[derive(Debug, Clone)]
struct LocalGlossaryRow {
    term: String,
    aliases: String,
    domain: String,
    note: String,
    hotword_enabled: bool,
}

#[derive(Debug, Clone)]
struct LocalRuleRow {
    before_text: String,
    after_text: String,
    hit_count: i32,
    accepted_as_rule: bool,
    updated_at_ms: i64,
}

pub fn build_lexicon_bundle_export(
    conn: &Connection,
    stable_only: bool,
    optional_label: Option<String>,
) -> Result<LexiconBundleDocument, String> {
    let glossary_terms = load_glossary_for_export(conn)?;
    let correction_rules = load_rules_for_export(conn, stable_only)?;
    Ok(LexiconBundleDocument {
        kind: BUNDLE_KIND.to_string(),
        version: BUNDLE_VERSION,
        exported_at_ms: now_ms(),
        exported_by: LexiconBundleExportedBy {
            app: "rushi-desktop".to_string(),
            optional_label: optional_label
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        },
        glossary_terms,
        correction_rules,
    })
}

pub fn serialize_lexicon_bundle(doc: &LexiconBundleDocument) -> Result<String, String> {
    serde_json::to_string_pretty(doc).map_err(|e| format!("序列化词表包失败：{e}"))
}

pub fn parse_lexicon_bundle_json(raw: &str) -> Result<LexiconBundleDocument, String> {
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|e| format!("词表包 JSON 无法解析：{e}"))?;
    if let Some(obj) = value.as_object() {
        for key in obj.keys() {
            if FORBIDDEN_TOP_LEVEL_KEYS
                .iter()
                .any(|deny| deny.eq_ignore_ascii_case(key))
            {
                return Err(format!("词表包禁止包含字段「{key}」（不得含语段或密钥）。"));
            }
        }
    }
    let doc: LexiconBundleDocument =
        serde_json::from_value(value).map_err(|e| format!("词表包结构无效：{e}"))?;
    validate_lexicon_bundle(&doc)?;
    Ok(doc)
}

pub fn validate_lexicon_bundle(doc: &LexiconBundleDocument) -> Result<(), String> {
    if doc.kind != BUNDLE_KIND {
        return Err(format!(
            "不支持的 kind（期望 {BUNDLE_KIND}，实际 {}）",
            doc.kind
        ));
    }
    if doc.version != BUNDLE_VERSION {
        return Err(format!(
            "不支持的 version（期望 {BUNDLE_VERSION}，实际 {}）",
            doc.version
        ));
    }
    Ok(())
}

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
            if local.hit_count == rule.hit_count
                && local.accepted_as_rule == rule.accepted_as_rule
            {
                skip_rules += 1;
            } else {
                skip_rules += 1;
            }
            continue;
        }
        let locals_for_before: Vec<&LocalRuleRow> = local_rules
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
        let locals_for_before: Vec<&LocalRuleRow> = local_rules
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

enum RuleCompare {
    BundleWins,
    LocalWins,
    Tie,
}

fn compare_rule_strength(a: &LocalRuleRow, b: &LocalRuleRow) -> std::cmp::Ordering {
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

fn compare_rule_pair(local: &LocalRuleRow, bundle: &LexiconBundleCorrectionRule) -> RuleCompare {
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

fn glossary_key(term: &str) -> String {
    term.trim().to_lowercase()
}

fn glossary_rows_compatible(local: &LocalGlossaryRow, bundle: &LexiconBundleGlossaryTerm) -> bool {
    local.aliases.trim() == bundle.aliases.trim()
        && local.domain.trim() == bundle.domain.trim()
        && local.note.trim() == bundle.note.trim()
        && local.hotword_enabled == bundle.hotword_enabled
}

fn merge_alias_strings(a: &str, b: &str) -> String {
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

fn dedupe_bundle_rules(rules: Vec<LexiconBundleCorrectionRule>) -> Vec<LexiconBundleCorrectionRule> {
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

fn load_glossary_for_export(conn: &Connection) -> Result<Vec<LexiconBundleGlossaryTerm>, String> {
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

fn load_rules_for_export(
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

fn load_local_glossary_map(conn: &Connection) -> Result<HashMap<String, LocalGlossaryRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT term, aliases, domain, note, hotword_enabled FROM glossary_terms",
        )
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

fn load_local_rules(conn: &Connection) -> Result<Vec<LocalRuleRow>, String> {
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

fn insert_glossary_row(
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

fn apply_glossary_bundle_row(
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

fn insert_rule_row(
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

fn merge_rule_pair(
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

fn replace_rules_for_before(
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::correction::list_stable_correction_rules;
    use crate::project::glossary_hotwords::build_glossary_hotwords;
    use crate::project::lexicon_pack::assemble_lexicon_pack;

    fn mem_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE glossary_terms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term TEXT NOT NULL COLLATE NOCASE UNIQUE,
                aliases TEXT NOT NULL DEFAULT '',
                domain TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                created_at_ms INTEGER NOT NULL,
                updated_at_ms INTEGER NOT NULL,
                hotword_enabled INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE correction_memory (
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
        conn
    }

    #[test]
    fn rejects_forbidden_top_level_key() {
        let raw = r#"{"kind":"rushi_lexicon_bundle","version":1,"segments":[]}"#;
        assert!(parse_lexicon_bundle_json(raw).is_err());
    }

    #[test]
    fn dedupe_bundle_rules_keeps_higher_hit() {
        let rules = dedupe_bundle_rules(vec![
            LexiconBundleCorrectionRule {
                before_text: "闪法".into(),
                after_text: "闪击".into(),
                hit_count: 1,
                accepted_as_rule: false,
                updated_at_ms: 10,
            },
            LexiconBundleCorrectionRule {
                before_text: "闪法".into(),
                after_text: "战法".into(),
                hit_count: 3,
                accepted_as_rule: false,
                updated_at_ms: 5,
            },
        ]);
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].after_text, "战法");
    }

    #[test]
    fn preview_rule_auto_resolves_when_bundle_hit_higher() {
        let conn = mem_db();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('闪法', '闪击', 1, 0, 1, 1)",
            [],
        )
        .unwrap();
        let doc = LexiconBundleDocument {
            kind: BUNDLE_KIND.into(),
            version: 1,
            exported_at_ms: 1,
            exported_by: LexiconBundleExportedBy {
                app: "test".into(),
                optional_label: None,
            },
            glossary_terms: vec![],
            correction_rules: vec![LexiconBundleCorrectionRule {
                before_text: "闪法".into(),
                after_text: "战法".into(),
                hit_count: 3,
                accepted_as_rule: false,
                updated_at_ms: 2,
            }],
        };
        let preview = preview_lexicon_bundle_import(&conn, &doc).unwrap();
        assert_eq!(preview.auto_resolved_rules, 1);
        assert!(preview.conflicts.is_empty());
    }

    #[test]
    fn apply_replaces_local_rule_when_bundle_wins() {
        let mut conn = mem_db();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('闪法', '闪击', 1, 0, 1, 1)",
            [],
        )
        .unwrap();
        let doc = LexiconBundleDocument {
            kind: BUNDLE_KIND.into(),
            version: 1,
            exported_at_ms: 1,
            exported_by: LexiconBundleExportedBy {
                app: "test".into(),
                optional_label: None,
            },
            glossary_terms: vec![],
            correction_rules: vec![LexiconBundleCorrectionRule {
                before_text: "闪法".into(),
                after_text: "战法".into(),
                hit_count: 3,
                accepted_as_rule: false,
                updated_at_ms: 2,
            }],
        };
        apply_lexicon_bundle_import(&mut conn, &doc, &[]).unwrap();
        let after: String = conn
            .query_row(
                "SELECT after_text FROM correction_memory WHERE before_text = '闪法'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(after, "战法");
    }

    /// F7 手测主路径（A 导出 → B 导入）：术语进 hotwords、稳定规则可被 F1/Pack 消费。
    #[test]
    fn f7_hand_test_ab_exchange_glossary_and_stable_rules() {
        let conn_a = mem_db();
        conn_a
            .execute(
                "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) \
                 VALUES ('觉观', '觉观门', '', '来自A', 1, 1, 1)",
                [],
            )
            .unwrap();
        conn_a
            .execute(
                "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
                 VALUES ('山通', '禅宗', 3, 0, 1, 1), ('闪法', '战法', 1, 0, 1, 1)",
                [],
            )
            .unwrap();

        let doc = build_lexicon_bundle_export(&conn_a, true, Some("手测用户A".into())).unwrap();
        assert_eq!(doc.exported_by.optional_label.as_deref(), Some("手测用户A"));
        assert_eq!(doc.glossary_terms.len(), 1);
        assert_eq!(doc.correction_rules.len(), 1);
        assert_eq!(doc.correction_rules[0].before_text, "山通");

        let json = serialize_lexicon_bundle(&doc).unwrap();
        assert!(!json.contains("\"segments\""));
        assert!(!json.contains("api_key"));

        let mut conn_b = mem_db();
        let doc_b = parse_lexicon_bundle_json(&json).unwrap();
        let preview = preview_lexicon_bundle_import(&conn_b, &doc_b).unwrap();
        assert_eq!(preview.insert_glossary, 1);
        assert_eq!(preview.insert_rules, 1);
        assert!(preview.conflicts.is_empty());

        apply_lexicon_bundle_import(&mut conn_b, &doc_b, &[]).unwrap();

        let hot = build_glossary_hotwords(&conn_b).unwrap();
        assert!(hot.preview.term_count >= 1, "B 机应有热词 token");
        assert!(
            hot.hotwords.contains("觉观"),
            "B 机 hotwords 串应含 A 导出的术语"
        );

        let stable = list_stable_correction_rules(&conn_b).unwrap();
        assert!(
            stable.iter().any(|r| r.wrong == "山通" && r.right == "禅宗"),
            "B 机稳定规则应含 A 的 山通→禅宗"
        );
        assert!(
            !stable.iter().any(|r| r.wrong == "闪法"),
            "hit=1 且 stable_only 导出时不应带入闪法"
        );

        let pack = assemble_lexicon_pack(&conn_b).unwrap();
        assert!(pack.glossary_canonical.iter().any(|t| t == "觉观"));
        assert!(
            pack.correction_rules.iter().any(|r| r.wrong == "山通" && r.right == "禅宗"),
            "R3t-E Pack 应可见导入规则"
        );
    }

    #[test]
    fn stable_only_export_filters_hit_one() {
        let conn = mem_db();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('a', 'b', 1, 0, 1, 1), ('c', 'd', 2, 0, 1, 1)",
            [],
        )
        .unwrap();
        let stable = load_rules_for_export(&conn, true).unwrap();
        assert_eq!(stable.len(), 1);
        assert_eq!(stable[0].before_text, "c");
    }
}

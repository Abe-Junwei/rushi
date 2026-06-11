//! F7: `rushi_lexicon_bundle.v1` export / import preview / apply (glossary + correction_memory).

#[path = "lexicon_bundle_db.rs"]
mod lexicon_bundle_db;
#[path = "lexicon_bundle_import.rs"]
mod lexicon_bundle_import;
#[path = "lexicon_bundle_types.rs"]
mod lexicon_bundle_types;

pub use lexicon_bundle_import::{apply_lexicon_bundle_import, preview_lexicon_bundle_import};
pub use lexicon_bundle_types::*;

use super::utils::now_ms;
use lexicon_bundle_db::{
    count_unstable_memory_rows, list_duplicate_before_groups, load_glossary_for_export,
    load_rules_for_export,
};
use lexicon_bundle_types::{
    LexiconBundleDocument, BUNDLE_KIND, BUNDLE_VERSION, FORBIDDEN_TOP_LEVEL_KEYS,
};
use rusqlite::Connection;

pub fn build_lexicon_bundle_export_preview(
    conn: &Connection,
    stable_only: bool,
) -> Result<lexicon_bundle_types::LexiconBundleExportPreview, String> {
    let glossary_terms = load_glossary_for_export(conn)?;
    let rules_export = load_rules_for_export(conn, stable_only)?;
    let rules_all = load_rules_for_export(conn, false)?;
    let (excluded_hit1_unaccepted, excluded_learning_unaccepted) =
        count_unstable_memory_rows(conn)?;
    let (duplicate_before_group_count, duplicate_before_samples) =
        list_duplicate_before_groups(conn)?;
    Ok(lexicon_bundle_types::LexiconBundleExportPreview {
        glossary_count: glossary_terms.len(),
        rules_export_count: rules_export.len(),
        rules_all_deduped_count: rules_all.len(),
        excluded_hit1_unaccepted,
        excluded_learning_unaccepted,
        duplicate_before_group_count,
        duplicate_before_samples,
    })
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

pub(crate) fn validate_lexicon_bundle(doc: &LexiconBundleDocument) -> Result<(), String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::correction::list_stable_correction_rules;
    use crate::project::glossary_hotwords::build_glossary_hotwords;
    use crate::project::lexicon_pack::assemble_lexicon_pack;
    use lexicon_bundle_db::{dedupe_bundle_rules, load_rules_for_export};
    use rusqlite::Connection;

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

    #[test]
    fn export_preview_counts_stable_filter_and_duplicate_before() {
        let conn = mem_db();
        conn.execute(
            "INSERT INTO glossary_terms (term, aliases, domain, note, hotword_enabled, created_at_ms, updated_at_ms) \
             VALUES ('觉观', '', '', '', 1, 1, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('山通', '禅宗', 3, 0, 1, 1), ('闪法', '闪击', 1, 0, 1, 1), ('闪法', '战法', 3, 0, 1, 1), ('试', '测', 2, 0, 1, 1)",
            [],
        )
        .unwrap();

        let stable = build_lexicon_bundle_export_preview(&conn, true).unwrap();
        assert_eq!(stable.glossary_count, 1);
        assert_eq!(stable.rules_export_count, 2);
        assert_eq!(stable.excluded_hit1_unaccepted, 1);
        assert_eq!(stable.excluded_learning_unaccepted, 1);
        assert_eq!(stable.duplicate_before_group_count, 1);
        assert!(stable.duplicate_before_samples.contains(&"闪法".to_string()));

        let all = build_lexicon_bundle_export_preview(&conn, false).unwrap();
        assert_eq!(all.rules_export_count, 3);
        assert_eq!(all.excluded_hit1_unaccepted, 1);
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
            stable
                .iter()
                .any(|r| r.wrong == "山通" && r.right == "禅宗"),
            "B 机稳定规则应含 A 的 山通→禅宗"
        );
        assert!(
            !stable.iter().any(|r| r.wrong == "闪法"),
            "hit=1 且 stable_only 导出时不应带入闪法"
        );

        let pack = assemble_lexicon_pack(&conn_b).unwrap();
        assert!(pack.glossary_canonical.iter().any(|t| t == "觉观"));
        assert!(
            pack.correction_rules
                .iter()
                .any(|r| r.wrong == "山通" && r.right == "禅宗"),
            "R3t-E Pack 应可见导入规则"
        );
    }

    #[test]
    fn stable_only_export_filters_below_stable_threshold() {
        let conn = mem_db();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('a', 'b', 1, 0, 1, 1), ('c', 'd', 2, 0, 1, 1), ('e', 'f', 3, 0, 1, 1)",
            [],
        )
        .unwrap();
        let stable = load_rules_for_export(&conn, true).unwrap();
        assert_eq!(stable.len(), 1);
        assert_eq!(stable[0].before_text, "e");
    }
}

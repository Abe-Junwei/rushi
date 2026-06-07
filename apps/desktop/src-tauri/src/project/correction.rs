#[path = "correction_hints.rs"]
mod correction_hints;
#[path = "correction_learn.rs"]
mod correction_learn;
#[path = "correction_store.rs"]
mod correction_store;
#[path = "correction_types.rs"]
mod correction_types;

pub use correction_hints::{
    collect_correction_rule_hints, list_glossary_learn_prompts, list_glossary_mine_candidates,
};
pub use correction_learn::{
    accept_correction_rule, learn_inferred_pairs_from_segment_save,
    upsert_explicit_correction_pairs,
};
pub use correction_store::{
    delete_correction_memory_entry, list_correction_memory_entries, list_stable_correction_rules,
    save_correction_memory_entry,
};
pub use correction_types::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::types::SegmentDto;
    use correction_learn::{
        infer_single_replacement, learn_inferred_pairs_from_segment_save,
        normalize_correction_learn_pair, should_learn_inferred_replacement,
        upsert_correction_memory,
    };
    use rusqlite::Connection;
    use std::collections::HashMap;

    #[test]
    fn should_learn_rejects_isolated_single_cjk_char_pair() {
        assert!(!should_learn_inferred_replacement("盈", "凌"));
        assert!(!should_learn_inferred_replacement("其", "七"));
        assert!(should_learn_inferred_replacement("山通", "禅宗"));
        assert!(should_learn_inferred_replacement("错误", "正确"));
    }

    #[test]
    fn should_learn_inferred_replacement_rejects_long_span() {
        let over32: String = "山通".repeat(17);
        assert!(over32.chars().count() > 32);
        assert!(!should_learn_inferred_replacement(&over32, &over32));
    }

    #[test]
    fn should_learn_inferred_replacement_accepts_up_to_32_chars() {
        let sixteen = "一二三四五六七八九零一二三四五六";
        assert_eq!(sixteen.chars().count(), 16);
        let thirty_two = format!("{sixteen}{sixteen}");
        assert_eq!(thirty_two.chars().count(), 32);
        let mut after: String = thirty_two.chars().collect();
        after.pop();
        after.push('末');
        assert!(should_learn_inferred_replacement(&thirty_two, &after));
    }

    #[test]
    fn learn_save_does_not_create_pair_from_segment_edit_without_memory() {
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
        let seg = |uid: &str, text: &str| SegmentDto {
            idx: 0,
            uid: Some(uid.to_string()),
            start_sec: 0.0,
            end_sec: 1.0,
            text: text.into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
        };
        let baseline = HashMap::from([(
            "u1".to_string(),
            "对有嗯嗯好不是说自己不是的".to_string(),
        )]);
        learn_inferred_pairs_from_segment_save(
            &conn,
            &baseline,
            &[seg("u1", "对有嗯嗯好")],
            1,
        )
        .unwrap();
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM correction_memory", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn learn_save_skips_infer_without_baseline() {
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
        let baseline = HashMap::<String, String>::new();
        let seg = |uid: &str, text: &str| SegmentDto {
            idx: 0,
            uid: Some(uid.to_string()),
            start_sec: 0.0,
            end_sec: 1.0,
            text: text.into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
        };
        learn_inferred_pairs_from_segment_save(&conn, &baseline, &[seg("u-new", "这是制控")], 1)
            .unwrap();
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM correction_memory", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
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
        save_correction_memory_entry(&conn, "新错", "新对", true, Some("旧错"), Some("旧对"))
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
            "UPDATE correction_memory SET hit_count = 3 WHERE before_text = '错A'",
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

    #[test]
    fn infer_single_replacement_finds_word_pair() {
        assert_eq!(
            infer_single_replacement("智控", "制控"),
            Some(("智控".to_string(), "制控".to_string()))
        );
    }

    #[test]
    fn infer_single_replacement_prefers_minimal_diff_not_whole_segment() {
        assert_eq!(
            infer_single_replacement("第二个要素是智控", "第二个要素是制控"),
            Some(("智控".to_string(), "制控".to_string()))
        );
        assert_eq!(infer_single_replacement("对有嗯嗯好不是说自己不是的", "对有嗯嗯好"), None);
        assert_eq!(
            infer_single_replacement("我们这一次的入学入学教育啊啊", "我们这一次的入学入学教育啊"),
            None,
        );
        assert_eq!(infer_single_replacement("好时间已到大家写日志", "好"), None);
    }

    #[test]
    fn learn_from_save_increments_hit_and_auto_glossary_at_three() {
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
        upsert_correction_memory(&conn, "智控", "制控", 1).unwrap();
        let seg = |uid: &str, text: &str| SegmentDto {
            idx: 0,
            uid: Some(uid.to_string()),
            start_sec: 0.0,
            end_sec: 1.0,
            text: text.into(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
        };
        let baseline1 = HashMap::from([("u1".to_string(), "这是智控".to_string())]);
        learn_inferred_pairs_from_segment_save(&conn, &baseline1, &[seg("u1", "这是制控")], 2)
            .unwrap();
        let baseline2 = HashMap::from([("u1".to_string(), "仍有智控".to_string())]);
        learn_inferred_pairs_from_segment_save(&conn, &baseline2, &[seg("u1", "仍有制控")], 3)
            .unwrap();
        let hit: i32 = conn
            .query_row(
                "SELECT hit_count FROM correction_memory WHERE before_text = '智控'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hit, 3);
        let term_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM glossary_terms WHERE term = '制控'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(term_count, 1);
    }
}

use super::super::postprocess_segment_ops::RefineSegmentItem;
use super::ground::{
    evidence_is_grounded, filter_grounded_lexicon_ops, is_punctuation_only_change,
};
use super::parse::parse_lexicon_proofread_json_lenient;
use super::prompt::build_stage_b_merged_proofread_prompt;
use super::types::{LexiconEvidence, LexiconProofreadOp};
use crate::project::lexicon_pack::{CorrectionRule, LexiconPack};

fn sample_pack() -> LexiconPack {
    LexiconPack {
        glossary_canonical: vec!["安那般那".into()],
        correction_rules: vec![CorrectionRule {
            wrong: "安波那那".into(),
            right: "安那般那".into(),
            source: "memory".into(),
            weight: "high".into(),
        }],
        pack_meta: None,
    }
}

fn seg(uid: &str, text: &str) -> RefineSegmentItem {
    RefineSegmentItem {
        uid: uid.into(),
        start_sec: 0.0,
        end_sec: 1.0,
        text: text.into(),
    }
}

#[test]
fn stage_b_prompt_accepts_custom_instructions() {
    let pack = sample_pack();
    let segments = vec![seg("seg-a", "安波那那很好")];
    let custom = "自定义任务说明\n约束：\n1. 只输出 JSON。";
    let prompt = build_stage_b_merged_proofread_prompt(&segments, &pack, Some(custom));
    assert!(prompt.starts_with(custom));
    assert!(prompt.contains("uid=seg-a"));
}

#[test]
fn stage_b_prompt_includes_lexicon_segments_and_constraints() {
    let pack = sample_pack();
    let segments = vec![seg("seg-a", "安波那那很好")];
    let prompt = build_stage_b_merged_proofread_prompt(&segments, &pack, None);
    assert!(prompt.contains("uid=seg-a"));
    assert!(prompt.contains("安波那那很好"));
    assert!(prompt.contains("安波那那→安那般那"));
    assert!(prompt.contains("只输出一个 JSON 对象"));
}

#[test]
fn is_punctuation_only_change_ignores_punct() {
    assert!(is_punctuation_only_change("你好世界", "你好，世界。"));
    assert!(!is_punctuation_only_change("你好", "您好"));
}

#[test]
fn grounds_rule_and_glossary_evidence() {
    let pack = sample_pack();
    assert!(evidence_is_grounded(
        &pack,
        &LexiconEvidence {
            evidence_type: "rule".into(),
            r#ref: "安波那那→安那般那".into(),
        }
    ));
    assert!(evidence_is_grounded(
        &pack,
        &LexiconEvidence {
            evidence_type: "glossary".into(),
            r#ref: "安那般那".into(),
        }
    ));
    assert!(!evidence_is_grounded(
        &pack,
        &LexiconEvidence {
            evidence_type: "rule".into(),
            r#ref: "幻觉→词条".into(),
        }
    ));
}

#[test]
fn accepts_punctuation_evidence_when_only_punct_changed() {
    let pack = LexiconPack {
        glossary_canonical: vec![],
        correction_rules: vec![],
        pack_meta: None,
    };
    let segments = vec![seg("a", "你好世界")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "你好，世界。".into(),
        evidence: LexiconEvidence {
            evidence_type: "punctuation".into(),
            r#ref: "补标点".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(stats.ignored_for_ui(), 0);
}

#[test]
fn filters_ungrounded_ops() {
    let pack = sample_pack();
    let segments = vec![seg("a", "安波那那")];
    let ops = vec![
        LexiconProofreadOp {
            op: "update_text".into(),
            uid: "a".into(),
            text: "安那般那".into(),
            evidence: LexiconEvidence {
                evidence_type: "rule".into(),
                r#ref: "安波那那→安那般那".into(),
            },
        },
        LexiconProofreadOp {
            op: "update_text".into(),
            uid: "a".into(),
            text: "x".into(),
            evidence: LexiconEvidence {
                evidence_type: "glossary".into(),
                r#ref: "不存在".into(),
            },
        },
    ];
    let (grounded, _warnings, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(grounded[0].text, "安那般那");
    assert_eq!(stats.ignored_for_ui(), 1);
}

#[test]
fn lenient_parse_accepts_missing_op_field() {
    let raw = r#"{"ops":[{"uid":"a","text":"你好，世界。","evidence":{"type":"punctuation","ref":"补标点"}},{"uid":"b","text":"bad"}]}"#;
    let result = parse_lexicon_proofread_json_lenient(raw).unwrap();
    assert_eq!(result.payload.ops.len(), 2);
    assert_eq!(result.payload.ops[0].op, "update_text");
    assert_eq!(result.skipped_malformed_ops, 0);
}

#[test]
fn lenient_parse_skips_malformed_ops() {
    let raw = r#"{"ops":[{"uid":"a","text":"你好，世界。","evidence":{"type":"punctuation","ref":"补标点"}},{}]}"#;
    let result = parse_lexicon_proofread_json_lenient(raw).unwrap();
    assert_eq!(result.payload.ops.len(), 1);
    assert_eq!(result.skipped_malformed_ops, 1);
}

#[test]
fn accepts_homophone_guess_when_cited_rule_does_not_apply() {
    let pack = LexiconPack {
        glossary_canonical: vec![],
        correction_rules: vec![CorrectionRule {
            wrong: "智控".into(),
            right: "制控".into(),
            source: "memory".into(),
            weight: "high".into(),
        }],
        pack_meta: None,
    };
    let segments = vec![seg("a", "也就是我们这个禅堂给你们指控")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "也就是我们这个禅堂给你们指令".into(),
        evidence: LexiconEvidence {
            evidence_type: "rule".into(),
            r#ref: "智控→制控".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(grounded[0].evidence.evidence_type, "llm_homophone");
    assert_eq!(stats.llm_homophone, 1);
}

#[test]
fn accepts_rule_evidence_when_segment_applies_cited_rule() {
    let pack = sample_pack();
    let segments = vec![seg("a", "安波那那")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "安那般那".into(),
        evidence: LexiconEvidence {
            evidence_type: "rule".into(),
            r#ref: "安波那那→安那般那".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(stats.ignored_for_ui(), 0);
}

#[test]
fn accepts_rule_plus_punctuation_in_same_op() {
    let pack = sample_pack();
    let segments = vec![seg("a", "安波那那很好")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "安那般那，很好。".into(),
        evidence: LexiconEvidence {
            evidence_type: "rule".into(),
            r#ref: "安波那那→安那般那".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(stats.ignored_for_ui(), 0);
}

#[test]
fn salvage_ops_from_truncated_json() {
    let raw = r#"{"ops":[{"uid":"a","text":"你好，世界。","evidence":{"type":"punctuation","ref":"补标点"}},{"uid":"b","text":"未完"#;
    let result = parse_lexicon_proofread_json_lenient(raw).unwrap();
    assert_eq!(result.payload.ops.len(), 1);
    assert_eq!(result.payload.ops[0].uid, "a");
}

#[test]
fn broken_json_without_salvageable_ops_is_user_friendly() {
    let raw = r#"{"ops":[broken"#;
    let err = parse_lexicon_proofread_json_lenient(raw).unwrap_err();
    assert!(err.contains("格式不完整"));
    assert!(!err.contains("expected"));
}

#[test]
fn accepts_punctuation_only_even_with_wrong_evidence_type() {
    let pack = LexiconPack {
        glossary_canonical: vec![],
        correction_rules: vec![],
        pack_meta: None,
    };
    let segments = vec![seg("a", "你好世界")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "你好，世界。".into(),
        evidence: LexiconEvidence {
            evidence_type: "标点".into(),
            r#ref: "".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(grounded[0].evidence.evidence_type, "punctuation");
    assert_eq!(stats.ignored_for_ui(), 0);
}

#[test]
fn infers_rule_evidence_when_llm_cites_wrong_ref_but_change_matches_pack() {
    let pack = sample_pack();
    let segments = vec![seg("a", "安波那那很好")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "安那般那，很好。".into(),
        evidence: LexiconEvidence {
            evidence_type: "glossary".into(),
            r#ref: "不存在".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(grounded[0].evidence.evidence_type, "rule");
    assert_eq!(stats.ignored_for_ui(), 0);
}

#[test]
fn accepts_ungrounded_homophone_typo_as_llm_candidate() {
    let pack = sample_pack();
    let segments = vec![seg("a", "他们在传讨佛法")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "他们在传统佛法".into(),
        evidence: LexiconEvidence {
            evidence_type: "homophone".into(),
            r#ref: "传讨→传统".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 1);
    assert_eq!(grounded[0].evidence.evidence_type, "llm_homophone");
    assert_eq!(grounded[0].evidence.r#ref, "传讨→传统");
    assert_eq!(stats.llm_homophone, 1);
    assert_eq!(stats.ignored_for_ui(), 0);
}

#[test]
fn rejects_whole_segment_rewrite_even_without_pack() {
    let pack = sample_pack();
    let segments = vec![seg("a", "安波那那")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "x".into(),
        evidence: LexiconEvidence {
            evidence_type: "glossary".into(),
            r#ref: "不存在".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 0);
    assert_eq!(stats.ungrounded, 1);
}

#[test]
fn unchanged_ops_do_not_count_as_ignored() {
    let pack = sample_pack();
    let segments = vec![seg("a", "安波那那")];
    let ops = vec![LexiconProofreadOp {
        op: "update_text".into(),
        uid: "a".into(),
        text: "安波那那".into(),
        evidence: LexiconEvidence {
            evidence_type: "rule".into(),
            r#ref: "安波那那→安那般那".into(),
        },
    }];
    let (grounded, _, stats) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
    assert_eq!(grounded.len(), 0);
    assert_eq!(stats.unchanged, 1);
    assert_eq!(stats.ignored_for_ui(), 0);
}

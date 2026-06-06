//! F0 stage B: lexicon-guided proofread — merged punct + typo prompt, parse, evidence grounding.

use super::postprocess_segment_ops::{
    extract_balanced_json_array, extract_balanced_json_object, extract_json_object_from_llm_content,
    RefineSegmentItem, SegmentRefineOp,
};
use crate::project::lexicon_pack::LexiconPack;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LexiconEvidence {
    #[serde(rename = "type")]
    pub evidence_type: String,
    pub r#ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LexiconProofreadOp {
    pub op: String,
    pub uid: String,
    pub text: String,
    pub evidence: LexiconEvidence,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LexiconProofreadLlmPayload {
    #[serde(default)]
    pub ops: Vec<LexiconProofreadOp>,
    #[serde(default)]
    pub rationale: Option<String>,
}

/// F0-v2+：一次 LLM 调用完成标点 + 词表有据改字。
pub fn build_stage_b_merged_proofread_prompt(
    segments: &[RefineSegmentItem],
    pack: &LexiconPack,
) -> String {
    let mut lines = vec![
        "任务：对下列语段依次（1）补充自然、克制的中文标点；（2）依据词表与纠错规则改正字（专名、术语、同音误写、前后不一致）。".to_string(),
        "约束：".to_string(),
        "1. 只输出一个 JSON 对象，不要 markdown 代码块。".to_string(),
        "2. ops 仅可包含 op=update_text，且 uid 必须来自输入。".to_string(),
        "3. 每条 op 必须带 evidence：type 为 punctuation | rule | glossary | inconsistent_term。".to_string(),
        "4. 仅补标点、未改字时 evidence.type=punctuation，ref=补标点。".to_string(),
        "5. rule 的 ref 格式为「错→对」：须与 correction_rules 完全一致，或「对」为词表 canonical 之一。".to_string(),
        "6. glossary 的 ref 为术语表 canonical 全文；同音改正也可用 rule 且「对」为 canonical。".to_string(),
        "7. inconsistent_term 的 ref 须包含词表 canonical 或「统一为：<词条>」。".to_string(),
        "8. 不要 merge/split 语段；不要润色、扩写或改时间轴。".to_string(),
        "9. 无把握时返回空 ops。".to_string(),
        r#"JSON 形状：{"ops":[{"op":"update_text","uid":"...","text":"...","evidence":{"type":"punctuation","ref":"补标点"}}],"rationale":"可选"}"#.to_string(),
        "词表 canonical：".to_string(),
    ];
    if pack.glossary_canonical.is_empty() {
        lines.push("（空）".to_string());
    } else {
        for t in &pack.glossary_canonical {
            lines.push(format!("- {t}"));
        }
    }
    lines.push("纠错规则：".to_string());
    if pack.correction_rules.is_empty() {
        lines.push("（空）".to_string());
    } else {
        for r in &pack.correction_rules {
            lines.push(format!("- [{}] {}→{}", r.weight, r.wrong, r.right));
        }
    }
    lines.push("输入语段：".to_string());
    for s in segments {
        lines.push(format!(
            "- uid={} [{:.3},{:.3}] {}",
            s.uid.trim(),
            s.start_sec,
            s.end_sec,
            s.text.trim()
        ));
    }
    lines.join("\n")
}

#[allow(dead_code)]
pub fn parse_lexicon_proofread_json(raw: &str) -> Result<LexiconProofreadLlmPayload, String> {
    parse_lexicon_proofread_json_lenient(raw).map(|r| r.payload)
}

#[derive(Debug, Clone)]
pub struct LexiconProofreadParseResult {
    pub payload: LexiconProofreadLlmPayload,
    pub skipped_malformed_ops: usize,
}

fn read_evidence_from_value(evidence_obj: &serde_json::Value) -> (String, String) {
    let evidence_type = evidence_obj
        .get("type")
        .or_else(|| evidence_obj.get("evidence_type"))
        .or_else(|| evidence_obj.get("evidenceType"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let reference = evidence_obj
        .get("ref")
        .or_else(|| evidence_obj.get("reference"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    (evidence_type, reference)
}

/// 逐条解析 ops：本机模型常漏 `op` / `evidence` 等字段。
fn parse_lexicon_op_from_value(item: &serde_json::Value) -> Option<LexiconProofreadOp> {
    let uid = item.get("uid")?.as_str()?.trim().to_string();
    let text = item.get("text")?.as_str()?.trim().to_string();
    if uid.is_empty() || text.is_empty() {
        return None;
    }
    let op = item
        .get("op")
        .and_then(|v| v.as_str())
        .unwrap_or("update_text")
        .trim()
        .to_string();

    let (evidence_type, reference) = if let Some(evidence_obj) = item.get("evidence") {
        read_evidence_from_value(evidence_obj)
    } else {
        // 无 evidence 时先假定为标点；filter 会用 is_punctuation_only_change 校验
        ("punctuation".to_string(), "补标点".to_string())
    };
    if evidence_type.is_empty() {
        return None;
    }

    Some(LexiconProofreadOp {
        op,
        uid,
        text,
        evidence: LexiconEvidence {
            evidence_type,
            r#ref: reference,
        },
    })
}

fn format_stage_b_json_parse_error(_err: &serde_json::Error) -> String {
    "智能改稿返回格式不完整，已跳过该批次中无法解析的部分。".to_string()
}

fn collect_lexicon_ops_from_array(
    items: &[serde_json::Value],
) -> (Vec<LexiconProofreadOp>, usize) {
    let mut ops = Vec::new();
    let mut skipped_malformed_ops = 0usize;
    for item in items {
        if let Some(op) = parse_lexicon_op_from_value(item) {
            ops.push(op);
        } else {
            skipped_malformed_ops += 1;
        }
    }
    (ops, skipped_malformed_ops)
}

fn salvage_lexicon_ops_from_broken_json(json_str: &str) -> Option<LexiconProofreadParseResult> {
    let ops_key = json_str.find("\"ops\"")?;
    let after_key = &json_str[ops_key..];
    let bracket_start = after_key.find('[')?;
    let array_slice = &after_key[bracket_start..];

    if let Some(arr_str) = extract_balanced_json_array(array_slice) {
        if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&arr_str) {
            let (ops, skipped_malformed_ops) = collect_lexicon_ops_from_array(&items);
            if !ops.is_empty() || skipped_malformed_ops > 0 {
                return Some(LexiconProofreadParseResult {
                    payload: LexiconProofreadLlmPayload {
                        ops,
                        rationale: None,
                    },
                    skipped_malformed_ops,
                });
            }
        }
    }

    let mut ops = Vec::new();
    let mut skipped_malformed_ops = 0usize;
    let mut search_from = 0usize;
    while search_from < array_slice.len() {
        let Some(rel) = array_slice[search_from..].find('{') else {
            break;
        };
        let start = search_from + rel;
        let Some(obj_str) = extract_balanced_json_object(&array_slice[start..]) else {
            break;
        };
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&obj_str) {
            if let Some(op) = parse_lexicon_op_from_value(&value) {
                ops.push(op);
            } else {
                skipped_malformed_ops += 1;
            }
        }
        search_from = start + obj_str.len();
    }

    if ops.is_empty() && skipped_malformed_ops == 0 {
        return None;
    }
    Some(LexiconProofreadParseResult {
        payload: LexiconProofreadLlmPayload {
            ops,
            rationale: None,
        },
        skipped_malformed_ops,
    })
}

pub fn parse_lexicon_proofread_json_lenient(raw: &str) -> Result<LexiconProofreadParseResult, String> {
    let parse_json_body = |json_str: &str| -> Result<LexiconProofreadParseResult, String> {
        match serde_json::from_str::<serde_json::Value>(json_str) {
            Ok(root) => {
                let rationale = root
                    .get("rationale")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let mut ops = Vec::new();
                let mut skipped_malformed_ops = 0usize;
                if let Some(arr) = root.get("ops").and_then(|v| v.as_array()) {
                    let collected = collect_lexicon_ops_from_array(arr);
                    ops = collected.0;
                    skipped_malformed_ops = collected.1;
                }
                Ok(LexiconProofreadParseResult {
                    payload: LexiconProofreadLlmPayload { ops, rationale },
                    skipped_malformed_ops,
                })
            }
            Err(err) => salvage_lexicon_ops_from_broken_json(json_str)
                .ok_or_else(|| format_stage_b_json_parse_error(&err)),
        }
    };

    match extract_json_object_from_llm_content(raw) {
        Ok(json_str) => parse_json_body(&json_str),
        Err(_) => salvage_lexicon_ops_from_broken_json(raw).ok_or_else(|| {
            "智能改稿返回格式不完整，已跳过该批次中无法解析的部分。".to_string()
        }),
    }
}

fn rule_ref(wrong: &str, right: &str) -> String {
    format!("{wrong}→{right}")
}

fn parse_wrong_right_ref(reference: &str) -> Option<(String, String)> {
    let t = reference.trim();
    let sep = if t.contains('→') {
        '→'
    } else if t.contains("->") {
        return t
            .split_once("->")
            .map(|(w, r)| (w.trim().to_string(), r.trim().to_string()));
    } else {
        return None;
    };
    let (wrong, right) = t.split_once(sep)?;
    let wrong = wrong.trim().to_string();
    let right = right.trim().to_string();
    if wrong.is_empty() || right.is_empty() || wrong == right {
        return None;
    }
    Some((wrong, right))
}

fn glossary_has_term(pack: &LexiconPack, term: &str) -> bool {
    let term = term.trim();
    if term.is_empty() {
        return false;
    }
    pack.glossary_canonical.iter().any(|t| t == term)
}

/// 去掉标点与空白后比较，用于验证 punctuation evidence。
pub fn is_punctuation_only_change(before: &str, after: &str) -> bool {
    normalize_text_core(before) == normalize_text_core(after)
}

fn normalize_text_core(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}

pub fn evidence_is_grounded(pack: &LexiconPack, evidence: &LexiconEvidence) -> bool {
    let ty = evidence.evidence_type.trim().to_lowercase();
    let reference = evidence.r#ref.trim();
    if reference.is_empty() {
        return false;
    }
    match ty.as_str() {
        "rule" | "homophone" => {
            if pack.correction_rules.iter().any(|r| {
                rule_ref(&r.wrong, &r.right) == reference
                    || format!("{}->{}", r.wrong, r.right) == reference
            }) {
                return true;
            }
            if let Some((_wrong, right)) = parse_wrong_right_ref(reference) {
                return glossary_has_term(pack, &right);
            }
            false
        }
        "glossary" => {
            if glossary_has_term(pack, reference) {
                return true;
            }
            if let Some((_wrong, right)) = parse_wrong_right_ref(reference) {
                return glossary_has_term(pack, &right);
            }
            false
        }
        "inconsistent_term" => pack.glossary_canonical.iter().any(|t| {
            reference.contains(t.as_str())
                || reference.contains(&format!("统一为：{t}"))
                || reference.contains(&format!("统一为:{t}"))
        }),
        "punctuation" => reference == "补标点" || reference.contains("标点"),
        _ => false,
    }
}

fn segment_rule_evidence_matches_change(before: &str, after: &str, reference: &str) -> bool {
    let Some((wrong, right)) = parse_wrong_right_ref(reference) else {
        return false;
    };
    if !before.contains(&wrong) {
        return false;
    }
    if is_punctuation_only_change(before, after) {
        return false;
    }
    let rule_applied = before.replace(&wrong, &right);
    if rule_applied == after {
        return true;
    }
    if is_punctuation_only_change(&rule_applied, after) {
        return true;
    }
    false
}

fn segment_glossary_evidence_matches_change(
    before: &str,
    after: &str,
    pack: &LexiconPack,
    reference: &str,
) -> bool {
    if is_punctuation_only_change(before, after) {
        return false;
    }
    if let Some((_wrong, right)) = parse_wrong_right_ref(reference) {
        return segment_rule_evidence_matches_change(before, after, reference)
            && glossary_has_term(pack, &right);
    }
    if !glossary_has_term(pack, reference) {
        return false;
    }
    after.contains(reference) && before != after
}

fn segment_inconsistent_term_matches_change(
    before: &str,
    after: &str,
    pack: &LexiconPack,
    reference: &str,
) -> bool {
    if is_punctuation_only_change(before, after) {
        return false;
    }
    pack.glossary_canonical.iter().any(|term| {
        reference.contains(term.as_str())
            && after.contains(term.as_str())
            && (before != after)
    })
}

/// 语段级校验：evidence 须与 before→after 实际改动一致（不仅 Pack 中存在规则）。
pub fn segment_evidence_matches_change(
    before: &str,
    after: &str,
    pack: &LexiconPack,
    evidence: &LexiconEvidence,
) -> bool {
    let ty = evidence.evidence_type.trim().to_lowercase();
    let reference = evidence.r#ref.trim();
    match ty.as_str() {
        "punctuation" => is_punctuation_only_change(before, after),
        "rule" | "homophone" => segment_rule_evidence_matches_change(before, after, reference),
        "glossary" => segment_glossary_evidence_matches_change(before, after, pack, reference),
        "inconsistent_term" => {
            segment_inconsistent_term_matches_change(before, after, pack, reference)
        }
        _ => false,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroundedLexiconOp {
    pub uid: String,
    pub text: String,
    pub evidence: LexiconEvidence,
}

fn segment_text_by_uid<'a>(segments: &'a [RefineSegmentItem], uid: &str) -> Option<&'a str> {
    segments
        .iter()
        .find(|s| s.uid.trim() == uid)
        .map(|s| s.text.as_str())
}

pub fn filter_grounded_lexicon_ops(
    pack: &LexiconPack,
    segments: &[RefineSegmentItem],
    raw_ops: Vec<LexiconProofreadOp>,
) -> Result<(Vec<GroundedLexiconOp>, Vec<String>, usize), String> {
    let mut by_uid: std::collections::HashSet<&str> = std::collections::HashSet::new();
    for s in segments {
        let uid = s.uid.trim();
        if !uid.is_empty() {
            by_uid.insert(uid);
        }
    }

    let mut grounded_by_uid: std::collections::HashMap<String, GroundedLexiconOp> =
        std::collections::HashMap::new();
    let mut warnings = Vec::new();
    let mut dropped = 0usize;

    for op in raw_ops {
        if op.op.trim() != "update_text" {
            dropped += 1;
            warnings.push(format!("丢弃非 update_text op：{}", op.op));
            continue;
        }
        let uid = op.uid.trim();
        if !by_uid.contains(uid) {
            dropped += 1;
            warnings.push(format!("丢弃未知 uid：{uid}"));
            continue;
        }
        if op.text.trim().is_empty() {
            dropped += 1;
            warnings.push(format!("丢弃空正文 uid：{uid}"));
            continue;
        }

        let ty = op.evidence.evidence_type.trim().to_lowercase();
        let before = segment_text_by_uid(segments, uid).unwrap_or("");
        if before == op.text {
            dropped += 1;
            continue;
        }
        if ty == "punctuation" {
            if !is_punctuation_only_change(before, &op.text) {
                dropped += 1;
                warnings.push(format!("丢弃非纯标点改动 uid={uid}"));
                continue;
            }
            grounded_by_uid.insert(
                uid.to_string(),
                GroundedLexiconOp {
                    uid: uid.to_string(),
                    text: op.text,
                    evidence: op.evidence,
                },
            );
            continue;
        }

        if !evidence_is_grounded(pack, &op.evidence) {
            dropped += 1;
            warnings.push(format!(
                "丢弃无依据 op uid={uid} evidence={}:{}",
                op.evidence.evidence_type, op.evidence.r#ref
            ));
            continue;
        }
        if !segment_evidence_matches_change(before, &op.text, pack, &op.evidence) {
            dropped += 1;
            warnings.push(format!(
                "丢弃依据与语段不符 op uid={uid} evidence={}:{}",
                op.evidence.evidence_type, op.evidence.r#ref
            ));
            continue;
        }
        grounded_by_uid.insert(
            uid.to_string(),
            GroundedLexiconOp {
                uid: uid.to_string(),
                text: op.text,
                evidence: op.evidence,
            },
        );
    }

    let grounded: Vec<GroundedLexiconOp> = grounded_by_uid.into_values().collect();

    let refine_ops: Vec<SegmentRefineOp> = grounded
        .iter()
        .map(|g| SegmentRefineOp::UpdateText {
            uid: g.uid.clone(),
            text: g.text.clone(),
        })
        .collect();
    super::postprocess_segment_ops::validate_refine_ops(segments, &refine_ops)?;

    Ok((grounded, warnings, dropped))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::lexicon_pack::CorrectionRule;

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
        let (grounded, _, dropped) = filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
        assert_eq!(grounded.len(), 1);
        assert_eq!(dropped, 0);
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
        let (grounded, _warnings, dropped) =
            filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
        assert_eq!(grounded.len(), 1);
        assert_eq!(grounded[0].text, "安那般那");
        assert_eq!(dropped, 1);
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
    fn rejects_rule_evidence_when_wrong_not_in_segment() {
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
        let (grounded, _, dropped) =
            filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
        assert_eq!(grounded.len(), 0);
        assert_eq!(dropped, 1);
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
        let (grounded, _, dropped) =
            filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
        assert_eq!(grounded.len(), 1);
        assert_eq!(dropped, 0);
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
        let (grounded, _, dropped) =
            filter_grounded_lexicon_ops(&pack, &segments, ops).unwrap();
        assert_eq!(grounded.len(), 1);
        assert_eq!(dropped, 0);
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
}

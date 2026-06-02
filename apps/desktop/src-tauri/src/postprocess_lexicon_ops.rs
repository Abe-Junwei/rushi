//! R3t-E: lexicon-guided proofread — prompt, parse, evidence grounding.

use crate::project::lexicon_pack::LexiconPack;
use super::postprocess_segment_ops::{
    extract_json_object_from_llm_content, RefineSegmentItem, SegmentRefineOp,
};
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

pub fn build_lexicon_proofread_prompt(
    segments: &[RefineSegmentItem],
    pack: &LexiconPack,
) -> String {
    let mut lines = vec![
        "任务：依据词表与纠错规则，对下列语段做有据校对，仅改正字（专名、术语、同音误写、前后不一致）。".to_string(),
        "约束：".to_string(),
        "1. 只输出一个 JSON 对象，不要 markdown 代码块。".to_string(),
        "2. ops 仅可包含 op=update_text，且 uid 必须来自输入。".to_string(),
        "3. 每条 op 必须带 evidence：type 为 rule | glossary | inconsistent_term，ref 须能对应词表或规则。".to_string(),
        "4. rule 的 ref 格式为「错→对」：须与 correction_rules 完全一致，或「对」为词表 canonical 之一。".to_string(),
        "5. glossary 的 ref 为术语表 canonical 全文；同音改正也可用 rule 且「对」为 canonical。".to_string(),
        "6. inconsistent_term 的 ref 须包含词表 canonical 或「统一为：<词条>」。".to_string(),
        "7. 无把握时返回空 ops。".to_string(),
        r#"JSON 形状：{"ops":[{"op":"update_text","uid":"...","text":"...","evidence":{"type":"glossary","ref":"觉观"}}],"rationale":"可选"}"#.to_string(),
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
            lines.push(format!(
                "- [{}] {}→{}",
                r.weight, r.wrong, r.right
            ));
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

pub fn parse_lexicon_proofread_json(raw: &str) -> Result<LexiconProofreadLlmPayload, String> {
    let json_str = extract_json_object_from_llm_content(raw)?;
    serde_json::from_str(&json_str).map_err(|e| format!("词表校对 JSON 无法解析：{e}"))
}

fn rule_ref(wrong: &str, right: &str) -> String {
    format!("{wrong}→{right}")
}

fn parse_wrong_right_ref(reference: &str) -> Option<(String, String)> {
    let t = reference.trim();
    let sep = if t.contains('→') {
        '→'
    } else if t.contains("->") {
        return t.split_once("->").map(|(w, r)| (w.trim().to_string(), r.trim().to_string()));
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
    pack.glossary_canonical
        .iter()
        .any(|t| t == term || term.contains(t.as_str()) || t.contains(term))
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

    let mut grounded: Vec<GroundedLexiconOp> = Vec::new();
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
        if !evidence_is_grounded(pack, &op.evidence) {
            dropped += 1;
            warnings.push(format!(
                "丢弃无依据 op uid={uid} evidence={}:{}",
                op.evidence.evidence_type, op.evidence.r#ref
            ));
            continue;
        }
        grounded.push(GroundedLexiconOp {
            uid: uid.to_string(),
            text: op.text,
            evidence: op.evidence,
        });
    }

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
    fn grounds_rule_ref_when_right_is_glossary_only() {
        let pack = LexiconPack {
            glossary_canonical: vec!["觉观".into()],
            correction_rules: vec![],
            pack_meta: None,
        };
        assert!(evidence_is_grounded(
            &pack,
            &LexiconEvidence {
                evidence_type: "rule".into(),
                r#ref: "决关→觉观".into(),
            }
        ));
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
}

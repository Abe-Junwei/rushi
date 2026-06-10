use super::super::postprocess_segment_ops::{
    validate_refine_ops, RefineSegmentItem, SegmentRefineOp,
};
use super::types::{
    GroundedLexiconOp, LexiconEvidence, LexiconProofreadOp, StageBLexiconDropStats,
};
use crate::project::lexicon_pack::LexiconPack;

fn normalize_evidence_type(raw: &str) -> String {
    let t = raw.trim().to_lowercase();
    match t.as_str() {
        "punctuation" | "punct" | "标点" | "补标点" => "punctuation".to_string(),
        "rule" | "规则" | "纠错" | "纠错记忆" => "rule".to_string(),
        "homophone" | "同音" | "同音推测" | "同音猜测" => "homophone".to_string(),
        "glossary" | "术语" | "词表" | "术语表" => "glossary".to_string(),
        "inconsistent_term" | "术语统一" | "不一致" => "inconsistent_term".to_string(),
        _ => t,
    }
}

fn normalize_lexicon_evidence(evidence: &LexiconEvidence) -> LexiconEvidence {
    let ty = evidence.evidence_type.trim().to_string();
    let mut reference = evidence.r#ref.trim().to_string();

    if ty == "补标点" && reference.is_empty() {
        return LexiconEvidence {
            evidence_type: "punctuation".to_string(),
            r#ref: "补标点".to_string(),
        };
    }
    if reference.is_empty() && (ty == "标点" || ty == "punctuation" || ty == "punct") {
        return LexiconEvidence {
            evidence_type: "punctuation".to_string(),
            r#ref: "补标点".to_string(),
        };
    }

    let normalized_type = normalize_evidence_type(&ty);
    if normalized_type.is_empty() {
        if reference == "补标点" || reference.contains("标点") {
            return LexiconEvidence {
                evidence_type: "punctuation".to_string(),
                r#ref: if reference.is_empty() {
                    "补标点".to_string()
                } else {
                    reference
                },
            };
        }
        if parse_wrong_right_ref(&reference).is_some() {
            return LexiconEvidence {
                evidence_type: "rule".to_string(),
                r#ref: reference,
            };
        }
        if !reference.is_empty() {
            return LexiconEvidence {
                evidence_type: "glossary".to_string(),
                r#ref: reference,
            };
        }
    }

    if normalized_type == "punctuation" && reference.is_empty() {
        reference = "补标点".to_string();
    }

    LexiconEvidence {
        evidence_type: normalized_type,
        r#ref: reference,
    }
}

fn infer_rule_evidence_from_change(
    pack: &LexiconPack,
    before: &str,
    after: &str,
) -> Option<LexiconEvidence> {
    for rule in &pack.correction_rules {
        let reference = rule_ref(&rule.wrong, &rule.right);
        if segment_rule_evidence_matches_change(before, after, &reference) {
            return Some(LexiconEvidence {
                evidence_type: "rule".to_string(),
                r#ref: reference,
            });
        }
    }
    None
}

fn try_ground_lexicon_op(
    pack: &LexiconPack,
    before: &str,
    after: &str,
    evidence: &LexiconEvidence,
) -> Option<LexiconEvidence> {
    if evidence_is_grounded(pack, evidence)
        && segment_evidence_matches_change(before, after, pack, evidence)
    {
        return Some(evidence.clone());
    }
    infer_rule_evidence_from_change(pack, before, after)
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

fn normalize_text_core(s: &str) -> String {
    s.chars().filter(|c| c.is_alphanumeric()).collect()
}

/// 去掉标点与空白后比较，用于验证 punctuation evidence。
pub fn is_punctuation_only_change(before: &str, after: &str) -> bool {
    normalize_text_core(before) == normalize_text_core(after)
}

/// 无 Pack 依据的同音改字候选：长度接近、非整段重写。
pub fn is_llm_homophone_candidate(before: &str, after: &str) -> bool {
    if is_punctuation_only_change(before, after) {
        return false;
    }
    let b = normalize_text_core(before);
    let a = normalize_text_core(after);
    if a.is_empty() {
        return false;
    }
    let len_b = b.chars().count();
    let len_a = a.chars().count();
    if len_b == 0 {
        return len_a <= 32;
    }
    let ratio = len_a as f64 / len_b as f64;
    (0.7..=1.35).contains(&ratio)
}

fn llm_homophone_evidence(evidence: &LexiconEvidence) -> LexiconEvidence {
    let reference = evidence.r#ref.trim();
    LexiconEvidence {
        evidence_type: "llm_homophone".to_string(),
        r#ref: if reference.is_empty() {
            "模型同音推测".to_string()
        } else {
            reference.to_string()
        },
    }
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
        reference.contains(term.as_str()) && after.contains(term.as_str()) && (before != after)
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
) -> Result<(Vec<GroundedLexiconOp>, Vec<String>, StageBLexiconDropStats), String> {
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
    let mut stats = StageBLexiconDropStats::default();

    for op in raw_ops {
        if op.op.trim() != "update_text" {
            stats.invalid += 1;
            warnings.push(format!("丢弃非 update_text op：{}", op.op));
            continue;
        }
        let uid = op.uid.trim();
        if !by_uid.contains(uid) {
            stats.invalid += 1;
            warnings.push(format!("丢弃未知 uid：{uid}"));
            continue;
        }
        if op.text.trim().is_empty() {
            stats.invalid += 1;
            warnings.push(format!("丢弃空正文 uid：{uid}"));
            continue;
        }

        let before = segment_text_by_uid(segments, uid).unwrap_or("");
        if before == op.text {
            stats.unchanged += 1;
            continue;
        }

        if is_punctuation_only_change(before, &op.text) {
            grounded_by_uid.insert(
                uid.to_string(),
                GroundedLexiconOp {
                    uid: uid.to_string(),
                    text: op.text.clone(),
                    evidence: LexiconEvidence {
                        evidence_type: "punctuation".to_string(),
                        r#ref: "补标点".to_string(),
                    },
                },
            );
            continue;
        }

        let evidence = normalize_lexicon_evidence(&op.evidence);
        if let Some(grounded_evidence) = try_ground_lexicon_op(pack, before, &op.text, &evidence) {
            grounded_by_uid.insert(
                uid.to_string(),
                GroundedLexiconOp {
                    uid: uid.to_string(),
                    text: op.text,
                    evidence: grounded_evidence,
                },
            );
            continue;
        }

        if is_llm_homophone_candidate(before, &op.text) {
            stats.llm_homophone += 1;
            grounded_by_uid.insert(
                uid.to_string(),
                GroundedLexiconOp {
                    uid: uid.to_string(),
                    text: op.text,
                    evidence: llm_homophone_evidence(&evidence),
                },
            );
            continue;
        }

        if !evidence_is_grounded(pack, &evidence) {
            stats.ungrounded += 1;
            warnings.push(format!(
                "丢弃无依据 op uid={uid} evidence={}:{}",
                evidence.evidence_type, evidence.r#ref
            ));
        } else {
            stats.evidence_mismatch += 1;
            warnings.push(format!(
                "丢弃依据与语段不符 op uid={uid} evidence={}:{}",
                evidence.evidence_type, evidence.r#ref
            ));
        }
    }

    let grounded: Vec<GroundedLexiconOp> = grounded_by_uid.into_values().collect();

    let refine_ops: Vec<SegmentRefineOp> = grounded
        .iter()
        .map(|g| SegmentRefineOp::UpdateText {
            uid: g.uid.clone(),
            text: g.text.clone(),
        })
        .collect();
    validate_refine_ops(segments, &refine_ops)?;

    Ok((grounded, warnings, stats))
}

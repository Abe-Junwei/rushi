use super::super::postprocess_segment_ops::{
    validate_refine_ops, RefineSegmentItem, SegmentRefineOp,
};
use super::types::{GroundedLexiconOp, LexiconEvidence, LexiconProofreadOp};
use crate::project::lexicon_pack::LexiconPack;

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
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}

/// 去掉标点与空白后比较，用于验证 punctuation evidence。
pub fn is_punctuation_only_change(before: &str, after: &str) -> bool {
    normalize_text_core(before) == normalize_text_core(after)
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
    validate_refine_ops(segments, &refine_ops)?;

    Ok((grounded, warnings, dropped))
}

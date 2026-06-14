use super::super::postprocess_segment_ops::{
    extract_balanced_json_array, extract_balanced_json_object, extract_json_object_from_llm_content,
};
use super::types::{
    LexiconEvidence, LexiconProofreadLlmPayload, LexiconProofreadOp, LexiconProofreadParseResult,
};

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

fn collect_lexicon_ops_from_array(items: &[serde_json::Value]) -> (Vec<LexiconProofreadOp>, usize) {
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

pub fn parse_lexicon_proofread_json_lenient(
    raw: &str,
) -> Result<LexiconProofreadParseResult, String> {
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
        Err(_) => salvage_lexicon_ops_from_broken_json(raw)
            .ok_or_else(|| "智能改稿返回格式不完整，已跳过该批次中无法解析的部分。".to_string()),
    }
}

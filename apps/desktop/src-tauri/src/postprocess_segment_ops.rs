//! R3t-D: validate LLM segment refine ops (merge / split / update_text).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const MIN_SPLIT_SIDE_SEC: f64 = 0.02;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RefineSegmentItem {
    pub uid: String,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum SegmentRefineOp {
    UpdateText {
        uid: String,
        text: String,
    },
    Merge {
        uids: Vec<String>,
    },
    Split {
        uid: String,
        at_sec: f64,
        left_text: String,
        right_text: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
pub struct SegmentRefineLlmPayload {
    #[serde(default)]
    pub ops: Vec<SegmentRefineOp>,
    #[serde(default)]
    pub rationale: Option<String>,
}

pub fn build_refine_segments_prompt(segments: &[RefineSegmentItem]) -> String {
    let mut lines = vec![
        "任务：根据下列语段，输出 JSON 调整建议（可合并、拆分或改字）。".to_string(),
        "约束：".to_string(),
        "1. 只输出一个 JSON 对象，不要 markdown 代码块，不要解释性前后缀。".to_string(),
        "2. ops 仅可引用输入中的 uid。".to_string(),
        "3. merge：uids 必须为输入中按时间相邻的连续语段（至少 2 个）。".to_string(),
        "4. split：at_sec 必须在对应语段时间范围内；left_text/right_text 为拆分后两侧正文。".to_string(),
        "5. update_text：只改字，不改时间。".to_string(),
        "6. 无把握时返回空 ops：{\"ops\":[],\"rationale\":\"...\"}。".to_string(),
        "JSON 形状：".to_string(),
        r#"{"ops":[{"op":"update_text","uid":"...","text":"..."},{"op":"merge","uids":["a","b"]},{"op":"split","uid":"...","at_sec":1.0,"left_text":"...","right_text":"..."}],"rationale":"可选"}"#.to_string(),
        "输入语段：".to_string(),
    ];
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

pub fn extract_json_object_from_llm_content(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.starts_with('{') {
        return Ok(trimmed.to_string());
    }
    if let Some(start) = trimmed.find("```") {
        let rest = &trimmed[start + 3..];
        let rest = rest.strip_prefix("json").unwrap_or(rest).trim_start();
        if let Some(end) = rest.find("```") {
            let inner = rest[..end].trim();
            if inner.starts_with('{') {
                return Ok(inner.to_string());
            }
        }
    }
    let start = trimmed.find('{').ok_or("LLM 返回中未找到 JSON 对象。")?;
    let end = trimmed.rfind('}').ok_or("LLM 返回中未找到 JSON 对象。")?;
    if end <= start {
        return Err("LLM 返回中未找到 JSON 对象。".to_string());
    }
    Ok(trimmed[start..=end].to_string())
}

pub fn parse_refine_ops_json(raw: &str) -> Result<SegmentRefineLlmPayload, String> {
    let json_str = extract_json_object_from_llm_content(raw)?;
    serde_json::from_str(&json_str).map_err(|e| format!("段界整理 JSON 无法解析：{e}"))
}

pub fn validate_refine_ops(
    segments: &[RefineSegmentItem],
    ops: &[SegmentRefineOp],
) -> Result<(), String> {
    if segments.is_empty() {
        return Err("缺少语段输入。".to_string());
    }
    let mut by_uid: HashMap<&str, &RefineSegmentItem> = HashMap::new();
    let mut order: Vec<&str> = Vec::new();
    for s in segments {
        let uid = s.uid.trim();
        if uid.is_empty() {
            return Err("语段 uid 为空。".to_string());
        }
        if s.end_sec <= s.start_sec {
            return Err(format!("语段 {uid} 时间范围无效。"));
        }
        if by_uid.insert(uid, s).is_some() {
            return Err(format!("重复 uid：{uid}"));
        }
        order.push(uid);
    }
    order.sort_by(|a, b| {
        let sa = by_uid[a];
        let sb = by_uid[b];
        sa.start_sec
            .partial_cmp(&sb.start_sec)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    for op in ops {
        match op {
            SegmentRefineOp::UpdateText { uid, text } => {
                let uid = uid.trim();
                if text.trim().is_empty() {
                    return Err(format!("update_text({uid}) 正文为空。"));
                }
                by_uid
                    .get(uid)
                    .ok_or_else(|| format!("update_text 引用了未知 uid：{uid}"))?;
            }
            SegmentRefineOp::Merge { uids } => {
                if uids.len() < 2 {
                    return Err("merge 至少需要 2 个 uid。".to_string());
                }
                let mut indices = Vec::new();
                for uid in uids {
                    let uid = uid.trim();
                    let idx = order
                        .iter()
                        .position(|x| *x == uid)
                        .ok_or_else(|| format!("merge 引用了未知 uid：{uid}"))?;
                    indices.push(idx);
                }
                indices.sort_unstable();
                indices.dedup();
                if indices.len() != uids.len() {
                    return Err("merge 含重复 uid。".to_string());
                }
                for w in indices.windows(2) {
                    if w[1] != w[0] + 1 {
                        return Err("merge 的 uid 必须在输入中时间相邻。".to_string());
                    }
                }
            }
            SegmentRefineOp::Split {
                uid,
                at_sec,
                left_text,
                right_text,
            } => {
                let uid = uid.trim();
                let seg = by_uid
                    .get(uid)
                    .ok_or_else(|| format!("split 引用了未知 uid：{uid}"))?;
                if left_text.trim().is_empty() || right_text.trim().is_empty() {
                    return Err(format!("split({uid}) 两侧正文不能为空。"));
                }
                let at = *at_sec;
                if at <= seg.start_sec + MIN_SPLIT_SIDE_SEC || at >= seg.end_sec - MIN_SPLIT_SIDE_SEC {
                    return Err(format!(
                        "split({uid}) 的 at_sec={at:.3} 不在有效范围内 ({:.3},{:.3})。",
                        seg.start_sec, seg.end_sec
                    ));
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(uid: &str, start: f64, end: f64, text: &str) -> RefineSegmentItem {
        RefineSegmentItem {
            uid: uid.into(),
            start_sec: start,
            end_sec: end,
            text: text.into(),
        }
    }

    #[test]
    fn rejects_unknown_uid_on_merge() {
        let segments = vec![seg("a", 0.0, 1.0, "甲"), seg("b", 1.0, 2.0, "乙")];
        let ops = vec![SegmentRefineOp::Merge {
            uids: vec!["a".into(), "z".into()],
        }];
        assert!(validate_refine_ops(&segments, &ops).is_err());
    }

    #[test]
    fn rejects_non_adjacent_merge() {
        let segments = vec![
            seg("a", 0.0, 1.0, "甲"),
            seg("b", 1.0, 2.0, "乙"),
            seg("c", 2.0, 3.0, "丙"),
        ];
        let ops = vec![SegmentRefineOp::Merge {
            uids: vec!["a".into(), "c".into()],
        }];
        assert!(validate_refine_ops(&segments, &ops).is_err());
    }

    #[test]
    fn rejects_invalid_split_point() {
        let segments = vec![seg("a", 0.0, 1.0, "甲乙")];
        let ops = vec![SegmentRefineOp::Split {
            uid: "a".into(),
            at_sec: 0.99,
            left_text: "甲".into(),
            right_text: "乙".into(),
        }];
        assert!(validate_refine_ops(&segments, &ops).is_err());
    }

    #[test]
    fn accepts_adjacent_merge_and_valid_split() {
        let segments = vec![seg("a", 0.0, 1.0, "甲"), seg("b", 1.0, 2.0, "乙")];
        let ops = vec![
            SegmentRefineOp::Merge {
                uids: vec!["a".into(), "b".into()],
            },
            SegmentRefineOp::Split {
                uid: "a".into(),
                at_sec: 0.5,
                left_text: "左".into(),
                right_text: "右".into(),
            },
        ];
        // merge validates adjacency only; split on "a" is valid before hypothetical apply order
        assert!(validate_refine_ops(&segments, &[ops[1].clone()]).is_ok());
        assert!(validate_refine_ops(&segments, &[ops[0].clone()]).is_ok());
    }

    #[test]
    fn parses_json_from_fenced_block() {
        let raw = "```json\n{\"ops\":[],\"rationale\":\"ok\"}\n```";
        let p = parse_refine_ops_json(raw).unwrap();
        assert!(p.ops.is_empty());
        assert_eq!(p.rationale.as_deref(), Some("ok"));
    }
}

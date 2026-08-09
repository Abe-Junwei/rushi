//! 讲稿优化稀疏修改协议：客户端原文为真源，模型只获得显式 edit 权限。

use std::collections::{HashMap, HashSet};

use serde_json::Value;

use super::{ExportPolishParsed, ExportPolishProtocolStats};

const CONTEXT_ECHO_NEIGHBOR_RADIUS: usize = 2;
const CONTEXT_ECHO_GRAM_WIDTH: usize = 5;
const CONTEXT_ECHO_MIN_NEIGHBOR_CHARS: usize = 10;
const CONTEXT_ECHO_MIN_COVERAGE_PERCENT: usize = 55;
const CONTEXT_ECHO_MIN_GAIN_PERCENT: usize = 25;

fn normalize_context_echo_text(text: &str) -> Vec<char> {
    text.chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn qgram_match_count(candidate: &[char], neighbor: &[char]) -> (usize, usize) {
    let width = CONTEXT_ECHO_GRAM_WIDTH;
    if candidate.len() < width || neighbor.len() < width {
        return (0, 0);
    }
    let candidate_grams: HashSet<&[char]> = candidate.windows(width).collect();
    let total = neighbor.len() - width + 1;
    let matched = neighbor
        .windows(width)
        .filter(|gram| candidate_grams.contains(*gram))
        .count();
    (matched, total)
}

fn candidate_borrows_neighbor(current: &[char], candidate: &[char], neighbor: &[char]) -> bool {
    if neighbor.len() < CONTEXT_ECHO_MIN_NEIGHBOR_CHARS || candidate == current {
        return false;
    }
    let (candidate_matches, total) = qgram_match_count(candidate, neighbor);
    if total == 0
        || candidate_matches < total.min(8)
        || candidate_matches * 100 < total * CONTEXT_ECHO_MIN_COVERAGE_PERCENT
    {
        return false;
    }
    let (current_matches, _) = qgram_match_count(current, neighbor);
    let candidate_percent = candidate_matches * 100 / total;
    let current_percent = current_matches * 100 / total;
    candidate_percent >= current_percent.saturating_add(CONTEXT_ECHO_MIN_GAIN_PERCENT)
}

pub(super) fn edit_has_neighbor_context_echo(
    index: usize,
    candidate: &str,
    input_lines: &[String],
) -> bool {
    let Some(current) = input_lines.get(index) else {
        return false;
    };
    let current = normalize_context_echo_text(current);
    let candidate = normalize_context_echo_text(candidate);
    if candidate.is_empty() {
        return false;
    }
    let start = index.saturating_sub(CONTEXT_ECHO_NEIGHBOR_RADIUS);
    let end = (index + CONTEXT_ECHO_NEIGHBOR_RADIUS + 1).min(input_lines.len());
    (start..end)
        .filter(|&neighbor_index| neighbor_index != index)
        .any(|neighbor_index| {
            let neighbor = normalize_context_echo_text(&input_lines[neighbor_index]);
            candidate_borrows_neighbor(&current, &candidate, &neighbor)
        })
}

fn reject_neighbor_context_echoes(parsed: &mut ExportPolishParsed, input_lines: &[String]) {
    for (index, candidate) in parsed.punct_lines.clone().iter().enumerate() {
        if edit_has_neighbor_context_echo(index, candidate, input_lines) {
            parsed.punct_lines[index] = input_lines[index].clone();
            parsed.contract_fallback_line_indices.push(index);
            parsed.protocol_stats.invalid_edits += 1;
            parsed.protocol_stats.context_echo_edits += 1;
        }
    }
    parsed.contract_fallback_line_indices.sort_unstable();
    parsed.contract_fallback_line_indices.dedup();
}

pub fn parse_export_lecture_optimize_json(
    raw: &str,
    input_uids: &[String],
    input_lines: &[String],
) -> Result<ExportPolishParsed, String> {
    if input_uids.len() != input_lines.len() || input_uids.is_empty() {
        return Err("讲稿优化 uid 与正文行不一致。".to_string());
    }
    let mut uid_to_index = HashMap::with_capacity(input_uids.len());
    for (index, uid) in input_uids.iter().enumerate() {
        let uid = uid.trim();
        if uid.is_empty() || uid_to_index.insert(uid, index).is_some() {
            return Err("讲稿优化输入 uid 为空或重复。".to_string());
        }
    }

    let value = parse_response_object(raw)?;
    if value.get("edits").is_none() {
        let mut legacy = super::parse_export_polish_json(raw, input_lines.len())?;
        legacy.protocol_stats.legacy_response = true;
        reject_neighbor_context_echoes(&mut legacy, input_lines);
        return Ok(legacy);
    }

    let edits = value
        .get("edits")
        .and_then(Value::as_array)
        .ok_or_else(|| "讲稿优化 edits 必须是 JSON 数组。".to_string())?;
    let mut lines = input_lines.to_vec();
    let mut stats = ExportPolishProtocolStats {
        sparse_response: true,
        ..ExportPolishProtocolStats::default()
    };
    let mut seen = HashSet::new();
    let mut mentioned = HashSet::new();
    let mut fallback_indices = HashSet::new();

    for edit in edits {
        let Some(object) = edit.as_object() else {
            stats.malformed_edits += 1;
            stats.invalid_edits += 1;
            continue;
        };
        let Some(uid) = object.get("uid").and_then(Value::as_str).map(str::trim) else {
            stats.malformed_edits += 1;
            stats.invalid_edits += 1;
            continue;
        };
        let Some(&index) = uid_to_index.get(uid) else {
            stats.unknown_uids += 1;
            stats.invalid_edits += 1;
            continue;
        };
        mentioned.insert(index);
        if !seen.insert(index) {
            stats.duplicate_uids += 1;
            stats.invalid_edits += 1;
            lines[index] = input_lines[index].clone();
            fallback_indices.insert(index);
            continue;
        }
        let text = object
            .get("text")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty());
        let Some(text) = text else {
            stats.empty_edits += 1;
            stats.invalid_edits += 1;
            fallback_indices.insert(index);
            continue;
        };
        let candidate = text.replace("\r\n", "\n");
        if edit_has_neighbor_context_echo(index, &candidate, input_lines) {
            stats.context_echo_edits += 1;
            stats.invalid_edits += 1;
            fallback_indices.insert(index);
            continue;
        }
        lines[index] = candidate;
    }

    let mut break_after_line = Vec::new();
    match value.get("break_after_uid") {
        None | Some(Value::Null) => {}
        Some(Value::Array(rows)) => {
            for row in rows {
                let Some(uid) = row.as_str().map(str::trim) else {
                    stats.invalid_break_uids += 1;
                    continue;
                };
                match uid_to_index.get(uid) {
                    // 批末 uid 可能正好是全文中的自然段边界，交给合并层换算全文下标。
                    Some(&index) => break_after_line.push(index),
                    None => stats.invalid_break_uids += 1,
                }
            }
        }
        Some(_) => stats.invalid_break_uids += 1,
    }
    break_after_line.sort_unstable();
    break_after_line.dedup();

    stats.omitted_unchanged = input_lines.len().saturating_sub(mentioned.len());
    let mut contract_fallback_line_indices: Vec<usize> = fallback_indices.into_iter().collect();
    contract_fallback_line_indices.sort_unstable();
    Ok(ExportPolishParsed {
        punct_lines: lines,
        // 稀疏协议已安全映射；坏 edit 被逐条丢弃，不应触发整批重试。
        content_contract_valid: true,
        contract_fallback_line_indices,
        break_after_line,
        protocol_stats: stats,
    })
}

fn parse_response_object(raw: &str) -> Result<Value, String> {
    let stripped = super::strip_llm_reasoning_wrappers(raw);
    if let Ok(value) = serde_json::from_str::<Value>(stripped.trim()) {
        if value.is_object() {
            return Ok(value);
        }
    }
    let json = super::extract_json_object_from_llm_content(raw)
        .map_err(|_| "讲稿优化返回中未找到 JSON 对象。".to_string())?;
    let value: Value =
        serde_json::from_str(&json).map_err(|error| format!("讲稿优化 JSON 无法解析：{error}"))?;
    value
        .is_object()
        .then_some(value)
        .ok_or_else(|| "讲稿优化返回必须是 JSON 对象。".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> (Vec<String>, Vec<String>) {
        (
            vec!["u0".into(), "u1".into(), "u2".into()],
            vec!["甲".into(), "乙".into(), "丙".into()],
        )
    }

    #[test]
    fn sparse_omission_means_unchanged() {
        let (uids, lines) = input();
        let parsed = parse_export_lecture_optimize_json(
            r#"{"edits":[{"uid":"u1","text":"乙。"}],"break_after_uid":["u1"]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert_eq!(parsed.punct_lines, vec!["甲", "乙。", "丙"]);
        assert_eq!(parsed.break_after_line, vec![1]);
        assert_eq!(parsed.protocol_stats.omitted_unchanged, 2);
        assert!(parsed.content_contract_valid);
    }

    #[test]
    fn bad_edits_do_not_affect_valid_siblings() {
        let (uids, lines) = input();
        let parsed = parse_export_lecture_optimize_json(
            r#"{"edits":[{"uid":"u0","text":"甲。"},{"uid":"u1","text":"乙改"},{"uid":"u1","text":"重复"},{"uid":"missing","text":"越界"},{"uid":"u2","text":""},42]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert_eq!(parsed.punct_lines, vec!["甲。", "乙", "丙"]);
        assert_eq!(parsed.contract_fallback_line_indices, vec![1, 2]);
        assert_eq!(parsed.protocol_stats.invalid_edits, 4);
        assert_eq!(parsed.protocol_stats.duplicate_uids, 1);
        assert_eq!(parsed.protocol_stats.unknown_uids, 1);
        assert_eq!(parsed.protocol_stats.empty_edits, 1);
        assert_eq!(parsed.protocol_stats.malformed_edits, 1);
    }

    #[test]
    fn empty_sparse_response_is_valid() {
        let (uids, lines) = input();
        let parsed = parse_export_lecture_optimize_json(
            r#"{"edits":[],"break_after_uid":[]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert_eq!(parsed.punct_lines, lines);
        assert_eq!(parsed.protocol_stats.omitted_unchanged, 3);
    }

    #[test]
    fn sparse_break_after_batch_final_uid_is_preserved() {
        let (uids, lines) = input();
        let parsed = parse_export_lecture_optimize_json(
            r#"{"edits":[],"break_after_uid":["u2"]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert_eq!(parsed.break_after_line, vec![2]);
    }

    #[test]
    fn exact_neighbor_context_echo_is_rejected_per_edit() {
        let uids = vec!["u0".into(), "u1".into(), "u2".into()];
        let lines = vec![
            "甚至看到周围的人上去了。".into(),
            "结果在看到周围的人的时候，".into(),
            "老子又不自觉的又跳到这个肉上去了，".into(),
        ];
        let parsed = parse_export_lecture_optimize_json(
            r#"{"edits":[{"uid":"u2","text":"结果在看到周围的人的时候，又不自觉的又跳到这个肉上去了，"}],"break_after_uid":[]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert_eq!(parsed.punct_lines, lines);
        assert_eq!(parsed.contract_fallback_line_indices, vec![2]);
        assert_eq!(parsed.protocol_stats.context_echo_edits, 1);
    }

    #[test]
    fn fuzzy_two_lines_back_context_echo_is_rejected() {
        let uids = vec!["u0".into(), "u1".into(), "u2".into()];
        let lines = vec![
            "我们的心理学基础比其他搞身心理修炼的人的心理学基础更扎实。".into(),
            "就是我们这套心理学，".into(),
            "一个是佛教呼叫心理学。".into(),
        ];
        let parsed = parse_export_lecture_optimize_json(
            r#"{"edits":[{"uid":"u2","text":"基础比其他搞身心灵修炼的人的心理学基础更扎实。一个是佛教心理学。"}],"break_after_uid":[]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert_eq!(parsed.punct_lines, lines);
        assert_eq!(parsed.contract_fallback_line_indices, vec![2]);
        assert_eq!(parsed.protocol_stats.context_echo_edits, 1);
    }

    #[test]
    fn local_rewrite_with_only_short_neighbor_overlap_is_allowed() {
        let uids = vec!["u0".into(), "u1".into(), "u2".into()];
        let lines = vec![
            "佛教心理学有完整体系。".into(),
            "这个心理学很重要。".into(),
            "我们继续往下讲。".into(),
        ];
        let parsed = parse_export_lecture_optimize_json(
            r#"{"edits":[{"uid":"u1","text":"这一心理学体系很重要。"}],"break_after_uid":[]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert_eq!(parsed.punct_lines[1], "这一心理学体系很重要。");
        assert!(parsed.contract_fallback_line_indices.is_empty());
    }

    #[test]
    fn legacy_items_remain_readable_during_migration() {
        let (uids, lines) = input();
        let parsed = parse_export_lecture_optimize_json(
            r#"{"items":[{"id":0,"text":"甲。"},{"id":1,"text":"乙"},{"id":2,"text":"丙"}],"break_after_line":[]}"#,
            &uids,
            &lines,
        )
        .unwrap();
        assert!(parsed.protocol_stats.legacy_response);
        assert_eq!(parsed.punct_lines[0], "甲。");
    }

    #[test]
    fn sparse_3541_uid_snapshot_has_full_destination_coverage() {
        let uids: Vec<String> = (0..3541).map(|index| format!("uid-{index}")).collect();
        let lines: Vec<String> = (0..3541).map(|index| format!("原文-{index}")).collect();
        let edits: Vec<Value> = (0..3541)
            .step_by(101)
            .map(|index| {
                serde_json::json!({
                    "uid": uids[index],
                    "text": format!("优化-{index}")
                })
            })
            .collect();
        let raw = serde_json::json!({ "edits": edits, "break_after_uid": [] }).to_string();
        let parsed = parse_export_lecture_optimize_json(&raw, &uids, &lines).unwrap();
        assert_eq!(parsed.punct_lines.len(), 3541);
        assert_eq!(parsed.protocol_stats.omitted_unchanged, 3505);
        for index in 0..3541 {
            let expected = if index % 101 == 0 {
                format!("优化-{index}")
            } else {
                format!("原文-{index}")
            };
            assert_eq!(parsed.punct_lines[index], expected);
        }
    }
}

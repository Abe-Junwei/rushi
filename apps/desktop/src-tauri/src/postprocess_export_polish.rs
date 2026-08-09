//! EXP-WORD：交付导出润色 — 可信正文上的 LLM 标点与语义断段。

#[path = "postprocess_export_lecture_optimize.rs"]
mod lecture_optimize;
#[path = "postprocess_export_polish_prompt.rs"]
mod prompt;

use super::postprocess_segment_ops::{
    extract_balanced_json_array, extract_json_object_from_llm_content, strip_llm_reasoning_wrappers,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const MAX_EXPORT_POLISH_INPUT_CHARS: usize = 120_000;
/// 语段行间分隔（ASCII RS）；与 TS `EXPORT_POLISH_LINE_SEPARATOR` 一致。
pub const EXPORT_POLISH_LINE_SEPARATOR: char = '\u{001e}';
#[cfg(test)]
pub const MAX_PARAGRAPHS: usize = 500;
/// 超过此行数则拆成多批 LLM 请求（避免输出 token 截断）。
pub const EXPORT_POLISH_BATCH_LINE_THRESHOLD: usize = 120;
/// 单批最多语段行数。
pub const EXPORT_POLISH_BATCH_MAX_LINES: usize = 100;
/// 单批失败后可对半拆分重试的最小行数。
pub const EXPORT_POLISH_RETRY_SPLIT_MIN_LINES: usize = 24;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportPolishParsed {
    /// 仅在 `content_contract_valid` 时来自 LLM；否则由命令层按批回退原文。
    pub punct_lines: Vec<String>,
    /// LLM 是否完整返回了本批 `0..line_count` 的唯一 ID 集合。
    pub content_contract_valid: bool,
    /// 因 ID/结构契约异常而回退输入正文的语段下标。
    pub contract_fallback_line_indices: Vec<usize>,
    /// 在哪些语段行下标之后插入 Word 自然段分界（含该行）。
    pub break_after_line: Vec<usize>,
    pub protocol_stats: ExportPolishProtocolStats,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPolishProtocolStats {
    pub omitted_unchanged: usize,
    pub invalid_edits: usize,
    pub unknown_uids: usize,
    pub duplicate_uids: usize,
    pub empty_edits: usize,
    pub malformed_edits: usize,
    pub context_echo_edits: usize,
    pub invalid_break_uids: usize,
    pub legacy_response: bool,
    pub sparse_response: bool,
    pub retried_edits: usize,
    pub recovered_edits: usize,
}

pub fn parse_export_lecture_optimize_json(
    raw: &str,
    input_uids: &[String],
    input_lines: &[String],
) -> Result<ExportPolishParsed, String> {
    lecture_optimize::parse_export_lecture_optimize_json(raw, input_uids, input_lines)
}

pub fn export_lecture_edit_has_context_echo(
    index: usize,
    candidate: &str,
    input_lines: &[String],
) -> bool {
    lecture_optimize::edit_has_neighbor_context_echo(index, candidate, input_lines)
}

pub fn lines_from_export_polish_body(body: &str) -> Vec<String> {
    if body.is_empty() {
        return vec![];
    }
    if body.contains(EXPORT_POLISH_LINE_SEPARATOR) {
        return body
            .split(EXPORT_POLISH_LINE_SEPARATOR)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect();
    }
    non_empty_lines_from_body(body)
}

pub fn non_empty_lines_from_body(body: &str) -> Vec<String> {
    body.split('\n')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

/// 按语段行切分正文；不超过阈值时返回单元素。
pub fn plan_export_polish_batch_bodies(body: &str) -> Vec<String> {
    let lines = lines_from_export_polish_body(body);
    plan_export_polish_batch_lines(&lines)
        .into_iter()
        .map(|chunk| chunk.join(&EXPORT_POLISH_LINE_SEPARATOR.to_string()))
        .collect()
}

pub fn plan_export_polish_batch_lines(lines: &[String]) -> Vec<Vec<String>> {
    if lines.is_empty() {
        return vec![];
    }
    if lines.len() <= EXPORT_POLISH_BATCH_LINE_THRESHOLD {
        return vec![lines.to_vec()];
    }
    lines
        .chunks(EXPORT_POLISH_BATCH_MAX_LINES)
        .map(|chunk| chunk.to_vec())
        .collect()
}

/// 将一批正文对半拆成两段（失败重试用）；不足两行则返回 None。
pub fn split_export_polish_batch_body(body: &str) -> Option<(String, String)> {
    let lines = lines_from_export_polish_body(body);
    if lines.len() < 2 {
        return None;
    }
    let mid = lines.len() / 2;
    let sep = EXPORT_POLISH_LINE_SEPARATOR.to_string();
    Some((lines[..mid].join(&sep), lines[mid..].join(&sep)))
}

/// 预览失败是否值得自动重试 / 拆批（截断、JSON 解析、空结果）。
pub fn export_polish_error_is_retriable(err: &str) -> bool {
    let e = err.to_lowercase();
    e.contains("finish_reason=length")
        || e.contains("输出被截断")
        || e.contains("内容契约")
        || e.contains("未返回可解析")
        || e.contains("未找到 json")
        || e.contains("模型未返回 lines")
        || e.contains("润色结果为空")
        || e.contains("润色 lines 为空")
        || e.contains("返回格式无法解析")
        || e.contains("无法解析的 json")
}

/// 契约异常只拆一层（100 -> 50 + 50），避免旧格式响应造成请求数指数增长。
pub fn should_split_export_polish_retry(line_count: usize, contract_invalid: bool) -> bool {
    line_count >= EXPORT_POLISH_RETRY_SPLIT_MIN_LINES
        && (!contract_invalid || line_count >= EXPORT_POLISH_BATCH_MAX_LINES)
}

/// 按 ID 对齐 items；缺失、重复或空正文只标记对应行回退。
fn lines_from_items_with_fallback(
    items: &Value,
    expected: usize,
) -> Option<(Vec<String>, Vec<usize>)> {
    let items = items.as_array()?;
    if expected == 0 {
        return None;
    }
    let mut slots = vec![None; expected];
    let mut invalid = vec![false; expected];
    for item in items {
        let Some(object) = item.as_object() else {
            continue;
        };
        let Some(id) = object
            .get("id")
            .and_then(Value::as_u64)
            .and_then(|id| usize::try_from(id).ok())
            .filter(|&id| id < expected)
        else {
            continue;
        };
        let text = object
            .get("text")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty());
        if invalid[id] || slots[id].is_some() || text.is_none() {
            invalid[id] = true;
            slots[id] = None;
            continue;
        }
        slots[id] = text.map(|text| text.replace("\r\n", "\n"));
    }
    let fallback_indices = slots
        .iter()
        .enumerate()
        .filter_map(|(index, text)| (text.is_none() || invalid[index]).then_some(index))
        .collect();
    let lines = slots.into_iter().map(Option::unwrap_or_default).collect();
    Some((lines, fallback_indices))
}

/// ID 契约异常时，不再按位置猜测；整批正文回退输入。
pub fn fallback_invalid_batch_to_originals(parsed: &mut ExportPolishParsed, batch_body: &str) {
    if parsed.content_contract_valid {
        return;
    }
    let originals = lines_from_export_polish_body(batch_body);
    let can_reconcile = parsed.punct_lines.len() == originals.len()
        && !parsed.contract_fallback_line_indices.is_empty()
        && parsed
            .contract_fallback_line_indices
            .iter()
            .all(|&index| index < originals.len());
    if can_reconcile {
        for &index in &parsed.contract_fallback_line_indices {
            parsed.punct_lines[index] = originals[index].clone();
        }
    } else {
        parsed.punct_lines = originals;
        parsed.contract_fallback_line_indices = (0..parsed.punct_lines.len()).collect();
    }
    // ID 已失去一一对应关系时，模型给出的断点也不能再映射到可信正文。
    parsed.break_after_line.clear();
}

/// 合并各批润色结果；`break_after_line` 转为全文 0 起下标。
pub fn merge_export_polish_batches(
    batches: Vec<ExportPolishParsed>,
    batch_line_counts: &[usize],
) -> ExportPolishParsed {
    let mut punct_lines = Vec::new();
    let mut break_after_line = Vec::new();
    let mut contract_fallback_line_indices = Vec::new();
    let mut content_contract_valid = true;
    let mut protocol_stats = ExportPolishProtocolStats::default();
    let mut offset = 0usize;
    for (i, batch) in batches.iter().enumerate() {
        punct_lines.extend(batch.punct_lines.iter().cloned());
        content_contract_valid &= batch.content_contract_valid;
        protocol_stats.omitted_unchanged += batch.protocol_stats.omitted_unchanged;
        protocol_stats.invalid_edits += batch.protocol_stats.invalid_edits;
        protocol_stats.unknown_uids += batch.protocol_stats.unknown_uids;
        protocol_stats.duplicate_uids += batch.protocol_stats.duplicate_uids;
        protocol_stats.empty_edits += batch.protocol_stats.empty_edits;
        protocol_stats.malformed_edits += batch.protocol_stats.malformed_edits;
        protocol_stats.context_echo_edits += batch.protocol_stats.context_echo_edits;
        protocol_stats.invalid_break_uids += batch.protocol_stats.invalid_break_uids;
        protocol_stats.legacy_response |= batch.protocol_stats.legacy_response;
        protocol_stats.sparse_response |= batch.protocol_stats.sparse_response;
        protocol_stats.retried_edits += batch.protocol_stats.retried_edits;
        protocol_stats.recovered_edits += batch.protocol_stats.recovered_edits;
        let batch_lines = batch_line_counts.get(i).copied().unwrap_or(0);
        contract_fallback_line_indices.extend(
            batch
                .contract_fallback_line_indices
                .iter()
                .filter(|&&line| line < batch_lines)
                .map(|&line| offset + line),
        );
        let is_last = i + 1 == batches.len();
        for &b in &batch.break_after_line {
            if !batch.protocol_stats.sparse_response
                && !is_last
                && batch_lines > 0
                && b + 1 == batch_lines
            {
                continue;
            }
            break_after_line.push(offset + b);
        }
        offset += batch_lines;
    }
    break_after_line.sort_unstable();
    break_after_line.dedup();
    contract_fallback_line_indices.sort_unstable();
    contract_fallback_line_indices.dedup();
    ExportPolishParsed {
        punct_lines,
        content_contract_valid,
        contract_fallback_line_indices,
        break_after_line,
        protocol_stats,
    }
}

pub fn default_export_polish_system_prompt() -> &'static str {
    prompt::default_export_polish_system_prompt()
}

pub fn default_export_polish_instructions_template() -> String {
    prompt::default_export_polish_instructions_template()
}

pub fn resolve_export_polish_system_prompt(system_override: Option<&str>) -> String {
    prompt::resolve_export_polish_system_prompt(system_override)
}

pub(crate) fn validate_export_polish_instructions_template(template: &str) -> Result<(), String> {
    prompt::validate_export_polish_instructions_template(template)
}

pub fn build_export_polish_prompt(
    body: &str,
    line_count: usize,
    rule_hints: &str,
    glossary_hints: &str,
    batch: Option<(usize, usize)>,
    instructions_override: Option<&str>,
) -> String {
    prompt::build_export_polish_prompt(
        body,
        line_count,
        rule_hints,
        glossary_hints,
        batch,
        instructions_override,
    )
}

pub fn build_export_lecture_optimize_prompt(
    body: &str,
    line_uids: &[String],
    rule_hints: &str,
    glossary_hints: &str,
    batch: Option<(usize, usize)>,
) -> String {
    prompt::build_export_lecture_optimize_prompt(body, line_uids, rule_hints, glossary_hints, batch)
}

pub fn resolve_export_lecture_optimize_system_prompt() -> String {
    prompt::resolve_export_lecture_optimize_system_prompt()
}

/// 由语段行 + 断段下标生成 Word 自然段（行内直接拼接，不插换行）。
#[cfg(test)]
pub fn paragraphs_from_break_after(lines: &[String], break_after: &[usize]) -> Vec<String> {
    if lines.is_empty() {
        return vec![];
    }
    let mut breaks: Vec<usize> = break_after
        .iter()
        .copied()
        .filter(|&i| i < lines.len().saturating_sub(1))
        .collect();
    breaks.sort_unstable();
    breaks.dedup();
    let mut out = Vec::new();
    let mut buf = String::new();
    for (i, line) in lines.iter().enumerate() {
        buf.push_str(line);
        if breaks.contains(&i) && !buf.is_empty() {
            out.push(buf);
            buf = String::new();
        }
    }
    if !buf.is_empty() {
        out.push(buf);
    }
    if out.is_empty() {
        out.push(lines.join(""));
    }
    out.into_iter().take(MAX_PARAGRAPHS).collect()
}

#[derive(Debug, Deserialize)]
struct ExportPolishPayload {
    #[serde(default)]
    items: Value,
    #[serde(default, alias = "punct_lines")]
    lines: Value,
    #[serde(default, rename = "break_after_line", alias = "breakAfterLine")]
    break_after_line: Value,
    #[serde(default)]
    paragraphs: Value,
}

pub fn count_body_lines(body: &str) -> usize {
    lines_from_export_polish_body(body).len()
}

fn finish_export_polish_payload(
    v: ExportPolishPayload,
    expected_line_count: usize,
) -> Result<ExportPolishParsed, String> {
    let (punct_lines, contract_fallback_line_indices, content_contract_valid) =
        match lines_from_items_with_fallback(&v.items, expected_line_count) {
            Some((lines, fallback_indices)) => {
                let valid = fallback_indices.is_empty();
                (lines, fallback_indices, valid)
            }
            None if v.lines.is_array() => {
                // 兼容旧自定义 prompt 的 JSON 形态，但正文 fail-closed；命令层按批回退输入。
                (Vec::new(), Vec::new(), false)
            }
            None => (Vec::new(), Vec::new(), false),
        };
    let mut break_after_line = value_usize_array(&v.break_after_line);
    if break_after_line.is_empty() {
        if let Some(paragraphs) = value_string_array(&v.paragraphs) {
            break_after_line = infer_break_after_from_paragraphs(expected_line_count, &paragraphs);
        }
    }
    Ok(ExportPolishParsed {
        punct_lines,
        content_contract_valid,
        contract_fallback_line_indices,
        break_after_line,
        protocol_stats: ExportPolishProtocolStats::default(),
    })
}

fn value_string_array(value: &Value) -> Option<Vec<String>> {
    value.as_array().map(|rows| {
        rows.iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect()
    })
}

fn value_usize_array(value: &Value) -> Vec<usize> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_u64)
        .filter_map(|n| usize::try_from(n).ok())
        .collect()
}

fn try_parse_lines_json_array(s: &str) -> Option<Vec<String>> {
    let trimmed = s.trim();
    if let Ok(arr) = serde_json::from_str::<Vec<String>>(trimmed) {
        if !arr.is_empty() {
            return Some(arr);
        }
    }
    if let Some(arr_str) = extract_balanced_json_array(trimmed) {
        if let Ok(arr) = serde_json::from_str::<Vec<String>>(&arr_str) {
            if !arr.is_empty() {
                return Some(arr);
            }
        }
    }
    None
}

fn try_plain_lines_fallback(s: &str, expected: usize) -> Option<ExportPolishParsed> {
    let lines: Vec<String> = s
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(ToString::to_string)
        .collect();
    if lines.is_empty() {
        return None;
    }
    if expected == 0 {
        return Some(ExportPolishParsed {
            punct_lines: lines,
            content_contract_valid: false,
            contract_fallback_line_indices: vec![],
            break_after_line: vec![],
            protocol_stats: ExportPolishProtocolStats::default(),
        });
    }
    let slack = (expected / 20).max(5);
    let min_ok = expected.saturating_sub(slack);
    if lines.len() >= min_ok && lines.len() <= expected {
        Some(ExportPolishParsed {
            punct_lines: lines,
            content_contract_valid: false,
            contract_fallback_line_indices: vec![],
            break_after_line: vec![],
            protocol_stats: ExportPolishProtocolStats::default(),
        })
    } else {
        None
    }
}

pub fn parse_export_polish_json(
    raw: &str,
    expected_line_count: usize,
) -> Result<ExportPolishParsed, String> {
    let stripped = strip_llm_reasoning_wrappers(raw);

    if let Ok(value) = serde_json::from_str::<Value>(stripped.trim()) {
        if value.is_object() {
            if let Ok(v) = serde_json::from_value::<ExportPolishPayload>(value) {
                return finish_export_polish_payload(v, expected_line_count);
            }
        } else if value.is_array() {
            return Ok(ExportPolishParsed {
                punct_lines: value_string_array(&value).unwrap_or_default(),
                content_contract_valid: false,
                contract_fallback_line_indices: vec![],
                break_after_line: vec![],
                protocol_stats: ExportPolishProtocolStats::default(),
            });
        }
    }

    if let Ok(json_str) = extract_json_object_from_llm_content(raw) {
        match serde_json::from_str::<ExportPolishPayload>(&json_str) {
            Ok(v) => return finish_export_polish_payload(v, expected_line_count),
            Err(e) => {
                return Err(format!(
                    "模型未返回可解析的 JSON（需 items + break_after_line）：{e}"
                ));
            }
        }
    }

    if let Some(lines) = try_parse_lines_json_array(&stripped) {
        return Ok(ExportPolishParsed {
            punct_lines: lines,
            content_contract_valid: false,
            contract_fallback_line_indices: vec![],
            break_after_line: vec![],
            protocol_stats: ExportPolishProtocolStats::default(),
        });
    }

    if let Some(parsed) = try_plain_lines_fallback(&stripped, expected_line_count) {
        return Ok(parsed);
    }

    let preview: String = stripped.chars().take(120).collect();
    Err(format!(
        "LLM 返回中未找到 JSON 对象。预期约 {expected_line_count} 行。预览：{preview}"
    ))
}

/// 兼容旧模型仍返回 paragraphs 时，反推断段下标。
fn infer_break_after_from_paragraphs(line_count: usize, paragraphs: &[String]) -> Vec<usize> {
    if line_count <= 1 || paragraphs.is_empty() {
        return vec![];
    }
    let flat: String = paragraphs.iter().map(|s| s.as_str()).collect();
    let flat_chars: Vec<char> = flat.chars().collect();
    let mut cursor = 0usize;
    let mut breaks = Vec::new();
    for (i, para) in paragraphs.iter().enumerate() {
        if i + 1 >= paragraphs.len() {
            break;
        }
        let len = para.chars().count();
        cursor = (cursor + len).min(flat_chars.len());
        if cursor > 0 {
            breaks.push(cursor.saturating_sub(1).min(line_count.saturating_sub(2)));
        }
    }
    breaks
}

#[cfg(test)]
#[path = "postprocess_export_polish_tests.rs"]
mod tests;

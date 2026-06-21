//! EXP-WORD：交付导出润色 — LLM 行级错字/标点 + 语义断段；稳定规则在 TS 侧最后覆盖。

use super::postprocess_segment_ops::{
    extract_balanced_json_array, extract_json_object_from_llm_content, strip_llm_reasoning_wrappers,
};
use serde::Deserialize;

pub const MAX_EXPORT_POLISH_INPUT_CHARS: usize = 120_000;
/// 语段行间分隔（ASCII RS）；与 TS `EXPORT_POLISH_LINE_SEPARATOR` 一致。
pub const EXPORT_POLISH_LINE_SEPARATOR: char = '\u{001e}';
#[cfg(test)]
pub const MAX_PARAGRAPHS: usize = 500;
/// 超过此行数则拆成多批 LLM 请求（避免输出 token 截断）。
pub const EXPORT_POLISH_BATCH_LINE_THRESHOLD: usize = 200;
/// 单批最多语段行数。
pub const EXPORT_POLISH_BATCH_MAX_LINES: usize = 180;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportPolishParsed {
    /// 与语段等长的润色行（错字/标点/空格，行数不变）。
    pub punct_lines: Vec<String>,
    /// 在哪些语段行下标之后插入 Word 自然段分界（含该行）。
    pub break_after_line: Vec<usize>,
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

/// 将单批 LLM 返回行数对齐到输入语段行数；缺失行回退为原文，避免导出缺段。
pub fn align_punct_lines_to_batch(
    punct_lines: &mut Vec<String>,
    expected: usize,
    batch_body: &str,
) {
    if expected == 0 {
        punct_lines.retain(|s| !s.trim().is_empty());
        return;
    }
    let originals = lines_from_export_polish_body(batch_body);
    while punct_lines.len() < expected {
        let idx = punct_lines.len();
        punct_lines.push(originals.get(idx).cloned().unwrap_or_default());
    }
    if punct_lines.len() > expected {
        let tail: String = punct_lines.split_off(expected - 1).join("");
        if let Some(last) = punct_lines.last_mut() {
            last.push_str(&tail);
        }
    }
    for i in 0..expected {
        if punct_lines.get(i).is_some_and(|s| s.trim().is_empty()) {
            if let Some(orig) = originals.get(i).filter(|s| !s.trim().is_empty()) {
                punct_lines[i] = orig.clone();
            }
        }
    }
}

/// 合并各批润色结果；`break_after_line` 转为全文 0 起下标。
pub fn merge_export_polish_batches(
    batches: Vec<ExportPolishParsed>,
    batch_line_counts: &[usize],
) -> ExportPolishParsed {
    let mut punct_lines = Vec::new();
    let mut break_after_line = Vec::new();
    let mut offset = 0usize;
    for (i, batch) in batches.iter().enumerate() {
        punct_lines.extend(batch.punct_lines.iter().cloned());
        let batch_lines = batch_line_counts.get(i).copied().unwrap_or(0);
        let is_last = i + 1 == batches.len();
        for &b in &batch.break_after_line {
            if !is_last && batch_lines > 0 && b + 1 == batch_lines {
                continue;
            }
            break_after_line.push(offset + b);
        }
        offset += batch_lines;
    }
    break_after_line.sort_unstable();
    break_after_line.dedup();
    ExportPolishParsed {
        punct_lines,
        break_after_line,
    }
}

pub fn default_export_polish_system_prompt() -> &'static str {
    "你是中文讲稿 ASR 润色助手。lines 会被程序原样写入导出稿，不得增删行。须逐行改正文错字、同音误识别、口语重复字并规范标点；另给 break_after_line。禁止 paragraphs 字段与整句编造。只输出合法 JSON。"
}

pub fn default_export_polish_instructions_template() -> String {
    r#"你是中文讲稿 ASR 润色器。输入为 {line_count} 条语段（每行一条，不得增删行）。**客户端将原样采用你返回的 lines，不会做二次删改或拒收**，因此必须在 lines 里直接写好全部修正。{batch_note}

## 输出 JSON（仅此结构）
{"lines":["行1",...,"行{line_count}"],"break_after_line":[0,3,7]}

## lines（应尽量 {line_count} 行；若合并语段可少 1–2 行，客户端会自动对齐）
对每一行在本行内完成（保持原意、人称与事实，禁止整句重写）：
1. **错字/同音误识别**：必须改正 obvious 问题（示例：传讨→传统，辛库→辛苦，小胸小→胸腔，棵→颗，的/地/得，在/再）。
2. **口语 ASR 噪声**：连续无义重复字应删减或合并（如 喔喔喔、啊啊啊、鹅鹅鹅、呜呜、哇哇 等）。
3. **标点与空格**：补全句号、逗号等，规范「，」前后空格。
无需改动的行请原样抄写。

## break_after_line
语义自然段：在哪些行**之后**另起段落（0 起下标，升序）。**尽量少分段**（建议全文不超过 12 段、相邻分段至少间隔 8 行语段）；分段仅影响 Word 版式，**不得**为分段产生修订。不要输出 paragraphs 字段。{rule_hints}

输入（{line_count} 行，语段之间以 Unicode RS「␞」分隔，语段内换行保留）：
{body}"#
        .to_string()
}

pub fn resolve_export_polish_system_prompt(system_override: Option<&str>) -> String {
    system_override
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| default_export_polish_system_prompt().to_string())
}

pub(crate) fn validate_export_polish_instructions_template(template: &str) -> Result<(), String> {
    let template = template.trim();
    if template.is_empty() {
        return Ok(());
    }
    let missing: Vec<&str> = ["{line_count}", "{batch_note}", "{rule_hints}", "{body}"]
        .into_iter()
        .filter(|placeholder| !template.contains(placeholder))
        .collect();
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "导出润色 User 指令缺少占位符：{}。",
            missing.join("、")
        ))
    }
}

fn apply_export_polish_template(
    template: &str,
    line_count: usize,
    batch_note: &str,
    rule_hints: &str,
    body: &str,
) -> String {
    template
        .replace("{line_count}", &line_count.to_string())
        .replace("{batch_note}", batch_note)
        .replace("{rule_hints}", rule_hints)
        .replace("{body}", body)
}

pub fn build_export_polish_prompt(
    body: &str,
    line_count: usize,
    rule_hints: &str,
    batch: Option<(usize, usize)>,
    instructions_override: Option<&str>,
) -> String {
    let batch_note = batch
        .map(|(i, n)| {
            format!(
                "\n\n【分批 {i}/{n}】下列为全稿按顺序切分的连续片段；break_after_line **仅相对本段** 0 起行下标。若非语义自然段结尾，**不要**在本段最后一行后分段。"
            )
        })
        .unwrap_or_default();
    let hints = if rule_hints.trim().is_empty() {
        String::new()
    } else {
        format!("\n\n项目稳定纠错规则（须在对应行落实，优先级高于你的推断）：\n{rule_hints}")
    };
    let template = instructions_override
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(default_export_polish_instructions_template);
    apply_export_polish_template(&template, line_count, &batch_note, &hints, body)
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
    #[serde(default, alias = "punct_lines")]
    lines: Vec<String>,
    #[serde(default, rename = "break_after_line", alias = "breakAfterLine")]
    break_after_line: Vec<usize>,
    #[serde(default)]
    paragraphs: Vec<String>,
}

pub fn count_body_lines(body: &str) -> usize {
    lines_from_export_polish_body(body).len()
}

fn finish_export_polish_payload(
    v: ExportPolishPayload,
    expected_line_count: usize,
) -> Result<ExportPolishParsed, String> {
    let punct_lines = if !v.lines.is_empty() {
        normalize_lines(v.lines, expected_line_count)?
    } else {
        Vec::new()
    };
    let mut break_after_line = v.break_after_line;
    if break_after_line.is_empty() && !v.paragraphs.is_empty() {
        break_after_line = infer_break_after_from_paragraphs(expected_line_count, &v.paragraphs);
    }
    if punct_lines.is_empty() && expected_line_count > 0 {
        return Err("模型未返回 lines（标点行）。请重试。".into());
    }
    Ok(ExportPolishParsed {
        punct_lines,
        break_after_line,
    })
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
        return normalize_lines(lines, expected)
            .ok()
            .map(|punct_lines| ExportPolishParsed {
                punct_lines,
                break_after_line: vec![],
            });
    }
    let slack = (expected / 20).max(5);
    let min_ok = expected.saturating_sub(slack);
    if lines.len() >= min_ok && lines.len() <= expected {
        normalize_lines(lines, expected)
            .ok()
            .map(|punct_lines| ExportPolishParsed {
                punct_lines,
                break_after_line: vec![],
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

    if let Ok(v) = serde_json::from_str::<ExportPolishPayload>(stripped.trim()) {
        return finish_export_polish_payload(v, expected_line_count);
    }

    if let Ok(json_str) = extract_json_object_from_llm_content(raw) {
        match serde_json::from_str::<ExportPolishPayload>(&json_str) {
            Ok(v) => return finish_export_polish_payload(v, expected_line_count),
            Err(e) => {
                return Err(format!(
                    "模型未返回可解析的 JSON（需 lines + break_after_line）：{e}"
                ));
            }
        }
    }

    if let Some(lines) = try_parse_lines_json_array(&stripped) {
        let punct_lines = normalize_lines(lines, expected_line_count)?;
        return Ok(ExportPolishParsed {
            punct_lines,
            break_after_line: vec![],
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

fn normalize_lines(rows: Vec<String>, expected: usize) -> Result<Vec<String>, String> {
    let mut lines: Vec<String> = rows
        .into_iter()
        .map(|p| p.trim().replace("\r\n", "\n"))
        .collect();
    if lines.is_empty() && expected > 0 {
        return Err("润色 lines 为空，请重试。".into());
    }
    if expected > 0 {
        if lines.len() > expected {
            let tail: String = lines.split_off(expected - 1).join("");
            if let Some(last) = lines.last_mut() {
                last.push_str(&tail);
            }
        }
        while lines.len() < expected {
            lines.push(String::new());
        }
    } else {
        lines.retain(|p| !p.is_empty());
        if lines.is_empty() {
            return Err("润色 lines 为空，请重试。".into());
        }
    }
    Ok(lines)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_break_and_lines() {
        let raw = r#"{"lines":["你好","世界。"],"break_after_line":[0]}"#;
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert_eq!(out.punct_lines.len(), 2);
        assert_eq!(out.break_after_line, vec![0]);
        let paras = paragraphs_from_break_after(&out.punct_lines, &out.break_after_line);
        assert_eq!(paras, vec!["你好", "世界。"]);
    }

    #[test]
    fn parse_accepts_fenced_json_and_camel_case_breaks() {
        let raw = "```json\n{\"lines\":[\"甲\",\"乙。\"],\"breakAfterLine\":[0]}\n```";
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert_eq!(out.punct_lines, vec!["甲", "乙。"]);
        assert_eq!(out.break_after_line, vec![0]);
    }

    #[test]
    fn parse_ignores_trailing_prose_after_json() {
        let raw = r#"{"lines":["句一","句二。"],"break_after_line":[]}

以上已完成润色。"#;
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert_eq!(out.punct_lines.len(), 2);
    }

    #[test]
    fn parse_allows_fewer_lines_than_expected() {
        let rows: Vec<String> = (0..175).map(|i| format!("行{i}")).collect();
        let raw = format!(
            r#"{{"lines":{},"break_after_line":[]}}"#,
            serde_json::to_string(&rows).unwrap()
        );
        let out = parse_export_polish_json(&raw, 176).unwrap();
        assert_eq!(out.punct_lines.len(), 176);
        assert_eq!(out.punct_lines[175], "");
    }

    #[test]
    fn export_polish_prompt_accepts_custom_template() {
        let custom = "润色 {line_count} 行。{batch_note}{rule_hints}\n{body}";
        let p = build_export_polish_prompt("a\nb", 2, "规则A", None, Some(custom));
        assert!(p.contains("润色 2 行"));
        assert!(p.contains("a\nb"));
        assert!(p.contains("规则A"));
    }

    #[test]
    fn export_polish_template_reports_missing_placeholders() {
        let err = validate_export_polish_instructions_template("只润色 {body}").unwrap_err();
        assert!(err.contains("{line_count}"));
        assert!(err.contains("{batch_note}"));
        assert!(err.contains("{rule_hints}"));
    }

    #[test]
    fn prompt_mentions_break_after_only() {
        let p = build_export_polish_prompt("a\nb", 2, "", None, None);
        assert!(p.contains("break_after_line"));
        assert!(p.contains("原样采用"));
    }

    #[test]
    fn parse_json_array_of_lines() {
        let raw = r#"["句一","句二。"]"#;
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert_eq!(out.punct_lines, vec!["句一", "句二。"]);
        assert!(out.break_after_line.is_empty());
    }

    #[test]
    fn parse_plain_newline_lines_fallback() {
        let raw = "句一\n句二。";
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert_eq!(out.punct_lines, vec!["句一", "句二。"]);
    }

    #[test]
    fn parse_after_think_block() {
        let raw = r#"推理中…
{"lines":["甲","乙。"],"break_after_line":[0]}"#;
        let out = parse_export_polish_json(raw, 2).unwrap();
        assert_eq!(out.punct_lines, vec!["甲", "乙。"]);
        assert_eq!(out.break_after_line, vec![0]);
    }

    #[test]
    fn plan_batches_splits_over_threshold() {
        let lines: Vec<String> = (0..250).map(|i| format!("行{i}")).collect();
        let body = lines.join(&EXPORT_POLISH_LINE_SEPARATOR.to_string());
        let batches = plan_export_polish_batch_bodies(&body);
        assert_eq!(batches.len(), 2);
        assert_eq!(count_body_lines(&batches[0]), 180);
        assert_eq!(count_body_lines(&batches[1]), 70);
    }

    #[test]
    fn lines_from_body_preserves_in_segment_newlines() {
        let body = format!("a{}b\nc", EXPORT_POLISH_LINE_SEPARATOR);
        assert_eq!(lines_from_export_polish_body(&body), vec!["a", "b\nc"]);
        assert_eq!(count_body_lines(&body), 2);
    }

    #[test]
    fn align_punct_lines_fills_empty_from_originals() {
        let batch = format!("甲{}乙", EXPORT_POLISH_LINE_SEPARATOR);
        let mut lines = vec!["甲。".to_string(), String::new()];
        align_punct_lines_to_batch(&mut lines, 2, &batch);
        assert_eq!(lines, vec!["甲。".to_string(), "乙".to_string()]);
    }

    #[test]
    fn plan_batches_single_under_threshold() {
        let body = "a\nb\nc";
        let batches = plan_export_polish_batch_bodies(body);
        assert_eq!(batches.len(), 1);
        assert_eq!(count_body_lines(&batches[0]), 3);
    }

    #[test]
    fn merge_batches_offsets_breaks_and_skips_boundary() {
        let b0 = ExportPolishParsed {
            punct_lines: vec!["a".into(), "b".into()],
            break_after_line: vec![0, 1],
        };
        let b1 = ExportPolishParsed {
            punct_lines: vec!["c".into()],
            break_after_line: vec![0],
        };
        let merged = merge_export_polish_batches(vec![b0, b1], &[2, 1]);
        assert_eq!(merged.punct_lines, vec!["a", "b", "c"]);
        assert_eq!(merged.break_after_line, vec![0, 2]);
    }
}

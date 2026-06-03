//! EXP-WORD：交付导出润色 — LLM 行级错字/标点 + 语义断段；稳定规则在 TS 侧最后覆盖。

use serde::Deserialize;

pub const MAX_EXPORT_POLISH_INPUT_CHARS: usize = 120_000;
#[allow(dead_code)]
pub const MAX_PARAGRAPHS: usize = 500;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportPolishParsed {
    /// 与语段等长的润色行（错字/标点/空格，行数不变）。
    pub punct_lines: Vec<String>,
    /// 在哪些语段行下标之后插入 Word 自然段分界（含该行）。
    pub break_after_line: Vec<usize>,
}

pub fn build_export_polish_prompt(
    body: &str,
    line_count: usize,
    rule_hints: &str,
) -> String {
    let hints = if rule_hints.trim().is_empty() {
        String::new()
    } else {
        format!("\n\n项目稳定纠错规则（须在对应行落实，优先级高于你的推断）：\n{rule_hints}")
    };
    format!(
        r#"你是中文讲稿 ASR 润色器。输入为 {line_count} 条语段（每行一条，不得增删行）。**客户端将原样采用你返回的 lines，不会做二次删改或拒收**，因此必须在 lines 里直接写好全部修正。

## 输出 JSON（仅此结构）
{{"lines":["行1",...,"行{line_count}"],"break_after_line":[0,3,7]}}

## lines（应尽量 {line_count} 行；若合并语段可少 1–2 行，客户端会自动对齐）
对每一行在本行内完成（保持原意、人称与事实，禁止整句重写）：
1. **错字/同音误识别**：必须改正 obvious 问题（示例：传讨→传统，辛库→辛苦，小胸小→胸腔，棵→颗，的/地/得，在/再）。
2. **口语 ASR 噪声**：连续无义重复字应删减或合并（如 喔喔喔、啊啊啊、鹅鹅鹅、呜呜、哇哇 等）。
3. **标点与空格**：补全句号、逗号等，规范「，」前后空格。
无需改动的行请原样抄写。

## break_after_line
语义自然段：在哪些行**之后**另起段落（0 起下标，升序）。**尽量少分段**（建议全文不超过 12 段、相邻分段至少间隔 8 行语段）；分段仅影响 Word 版式，**不得**为分段产生修订。不要输出 paragraphs 字段。{hints}

输入（{line_count} 行，行间 \\n）：
{body}"#
    )
}

/// 由语段行 + 断段下标生成 Word 自然段（行内直接拼接，不插换行）。
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
        if breaks.contains(&i) {
            if !buf.is_empty() {
                out.push(buf);
                buf = String::new();
            }
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
    lines: Vec<String>,
    #[serde(default, rename = "break_after_line")]
    break_after_line: Vec<usize>,
    #[serde(default)]
    paragraphs: Vec<String>,
}

pub fn count_body_lines(body: &str) -> usize {
    body.split('\n').map(str::trim).filter(|s| !s.is_empty()).count()
}

pub fn parse_export_polish_json(raw: &str, expected_line_count: usize) -> Result<ExportPolishParsed, String> {
    let trimmed = strip_markdown_fence(raw.trim());
    if let Ok(v) = serde_json::from_str::<ExportPolishPayload>(&trimmed) {
        let punct_lines = if !v.lines.is_empty() {
            normalize_lines(v.lines, expected_line_count)?
        } else {
            Vec::new()
        };
        let mut break_after_line = v.break_after_line;
        if break_after_line.is_empty() && !v.paragraphs.is_empty() {
            break_after_line =
                infer_break_after_from_paragraphs(expected_line_count, &v.paragraphs);
        }
        if punct_lines.is_empty() && expected_line_count > 0 {
            return Err("模型未返回 lines（标点行）。请重试。".into());
        }
        return Ok(ExportPolishParsed {
            punct_lines,
            break_after_line,
        });
    }
    Err("模型未返回可解析的 JSON（需 lines + break_after_line）。".into())
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

fn normalize_lines(rows: Vec<String>, _expected: usize) -> Result<Vec<String>, String> {
    let lines: Vec<String> = rows
        .into_iter()
        .map(|p| p.trim().replace("\r\n", "\n"))
        .filter(|p| !p.is_empty())
        .collect();
    if lines.is_empty() {
        return Err("润色 lines 为空，请重试。".into());
    }
    Ok(lines)
}

fn strip_markdown_fence(s: &str) -> String {
    let s = s.trim();
    if !s.starts_with("```") {
        return s.to_string();
    }
    let mut lines = s.lines();
    let _ = lines.next();
    let rest: String = lines.collect::<Vec<_>>().join("\n");
    rest.trim_end_matches("```").trim().to_string()
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
    fn parse_allows_fewer_lines_than_expected() {
        let mut rows: Vec<String> = (0..175).map(|i| format!("行{i}")).collect();
        let raw = format!(
            r#"{{"lines":{},"break_after_line":[]}}"#,
            serde_json::to_string(&rows).unwrap()
        );
        let out = parse_export_polish_json(&raw, 176).unwrap();
        assert_eq!(out.punct_lines.len(), 175);
    }

    #[test]
    fn prompt_mentions_break_after_only() {
        let p = build_export_polish_prompt("a\nb", 2, "");
        assert!(p.contains("break_after_line"));
        assert!(p.contains("原样采用"));
    }
}
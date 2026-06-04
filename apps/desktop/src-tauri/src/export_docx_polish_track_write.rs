//! 润色导出修订轨：Word 段落写入与 settings 修订开关。

use std::io::{Cursor, Read, Write};

use docx_rs::*;
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::export_docx::{
    add_body_paragraph, append_polished_paragraph_list, sanitize_docx_text, MAX_LECTURE_BODY_CHARS,
};

use super::diff::{
    before_lines_from_joined, diff_pieces_for_export_track, pieces_have_markup, push_del_str,
    push_ins_char, push_same_char, DiffPiece,
};

pub const POLISH_TRACK_AUTHOR: &str = "如是我闻 · 错字与标点";

fn polish_revision_date() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn track_body_run() -> Run {
    Run::new().size(24)
}

fn flatten_for_compare(s: &str) -> String {
    s.chars().filter(|c| *c != '\n' && *c != '\r').collect()
}

fn lines_paragraphs_chars_match(lines: &[String], paragraphs: &[String]) -> bool {
    let left: String = lines.iter().map(|s| s.as_str()).collect();
    let right: String = paragraphs.iter().map(|s| s.as_str()).collect();
    flatten_for_compare(&left) == flatten_for_compare(&right)
}

/// 展示段用字以 lines 为准；template 仅提供语义断段位置。
fn display_paragraphs_from_lines(lines: &[String], template: &[String]) -> Vec<String> {
    if lines.is_empty() {
        return template.to_vec();
    }
    if template.is_empty() {
        return lines
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
    }
    if lines_paragraphs_chars_match(lines, template) {
        return template.to_vec();
    }
    let lines_flat: String = lines.iter().map(|s| s.as_str()).collect();
    let lines_flat_chars: Vec<char> = lines_flat.chars().collect();
    let mut cursor = 0usize;
    let mut out = Vec::new();
    for para in template {
        let need = flatten_for_compare(para).chars().count();
        if need == 0 {
            continue;
        }
        if cursor >= lines_flat_chars.len() {
            break;
        }
        let end = (cursor + need).min(lines_flat_chars.len());
        let chunk: String = lines_flat_chars[cursor..end].iter().collect();
        cursor = end;
        if !chunk.is_empty() {
            out.push(chunk);
        }
    }
    if cursor < lines_flat_chars.len() {
        let tail: String = lines_flat_chars[cursor..].iter().collect();
        if !tail.is_empty() {
            if let Some(last) = out.last_mut() {
                last.push_str(&tail);
            } else {
                out.push(tail);
            }
        }
    }
    if out.is_empty() {
        return lines
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
    }
    out
}
fn paragraph_from_diff_pieces(pieces: &[DiffPiece], author: &str, date: &str) -> Paragraph {
    let mut para = Paragraph::new();
    for piece in pieces {
        match piece {
            DiffPiece::Same(text) if !text.is_empty() => {
                para = para.add_run(track_body_run().add_text(sanitize_docx_text(text)));
            }
            DiffPiece::Del(text) => {
                para = para.add_delete(
                    Delete::new()
                        .author(author)
                        .date(date)
                        .add_run(track_body_run().add_delete_text(sanitize_docx_text(text))),
                );
            }
            DiffPiece::Ins(text) => {
                para = para.add_insert(
                    Insert::new(track_body_run().add_text(sanitize_docx_text(text)))
                        .author(author)
                        .date(date),
                );
            }
            DiffPiece::Same(_) => {}
        }
    }
    para
}

/// 将每行 diff 归入对应展示自然段（按 paragraphs 扁平字符下标映射）。
fn accumulate_line_diffs_into_paragraphs(
    before_lines: &[String],
    corrected_lines: &[String],
    display_paragraphs: &[String],
) -> Vec<Vec<DiffPiece>> {
    let para_count = display_paragraphs.len().max(1);
    let mut buckets: Vec<Vec<DiffPiece>> = vec![Vec::new(); para_count];
    let mut char_para: Vec<usize> = Vec::new();
    for (pi, p) in display_paragraphs.iter().enumerate() {
        for _ in p.chars() {
            char_para.push(pi);
        }
    }
    let mut flat_pos = 0usize;
    for (li, (before, after)) in before_lines.iter().zip(corrected_lines.iter()).enumerate() {
        let pieces = diff_pieces_for_export_track(before, after);
        if pieces.is_empty() {
            flat_pos = flat_pos.saturating_add(after.chars().count());
            continue;
        }
        let pi = char_para.get(flat_pos).copied().unwrap_or_else(|| {
            if para_count == 0 {
                0
            } else {
                (li * para_count / before_lines.len().max(1)).min(para_count - 1)
            }
        });
        let bucket = &mut buckets[pi];
        for piece in pieces {
            match piece {
                DiffPiece::Same(s) => {
                    for ch in s.chars() {
                        push_same_char(bucket, ch);
                    }
                    flat_pos += s.chars().count();
                }
                DiffPiece::Ins(s) => {
                    for ch in s.chars() {
                        push_ins_char(bucket, ch);
                    }
                    flat_pos += s.chars().count();
                }
                DiffPiece::Del(s) => {
                    push_del_str(bucket, &s);
                }
            }
        }
    }
    buckets
}

/// 修订轨：逐行对比；展示用 `display_paragraphs`。`corrected_lines` 行数须与 `before_joined` 拆行一致。
pub fn append_polished_with_track_changes(
    mut doc: Docx,
    before_joined: &str,
    corrected_lines: &[String],
    display_paragraphs: &[String],
    spaced: bool,
) -> Docx {
    let before_lines = before_lines_from_joined(before_joined);
    if corrected_lines.len() != before_lines.len() || before_lines.is_empty() {
        return append_polished_paragraph_list(doc, display_paragraphs, spaced);
    }

    let author = POLISH_TRACK_AUTHOR;
    let date = polish_revision_date();
    let display = display_paragraphs_from_lines(corrected_lines, display_paragraphs);
    let buckets = accumulate_line_diffs_into_paragraphs(&before_lines, corrected_lines, &display);

    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;

    for (pi, para_text) in display.iter().enumerate() {
        let t = para_text.trim();
        if t.is_empty() {
            continue;
        }
        if char_budget == 0 {
            truncated = true;
            break;
        }
        let take = t.chars().count().min(char_budget);
        let chunk: String = t.chars().take(take).collect();
        char_budget = char_budget.saturating_sub(take);

        let bucket = buckets.get(pi).map(Vec::as_slice).unwrap_or(&[]);
        if pieces_have_markup(bucket) {
            doc = doc.add_paragraph(paragraph_from_diff_pieces(bucket, author, &date));
        } else {
            doc = add_body_paragraph(doc, &chunk, false);
        }
        if spaced {
            doc = doc.add_paragraph(Paragraph::new());
        }
        if take < t.chars().count() {
            truncated = true;
            break;
        }
    }

    if truncated {
        doc = add_body_paragraph(
            doc,
            "…（正文过长已截断，请改用「逐字稿」导出或分批导出）",
            false,
        );
    }
    doc
}
fn patch_settings_track_and_markup(xml: Vec<u8>) -> Result<Vec<u8>, String> {
    let mut s = String::from_utf8(xml).map_err(|e| format!("settings.xml 非 UTF-8: {e}"))?;
    let Some(idx) = s.rfind("</w:settings>") else {
        return Err("settings.xml 缺少 </w:settings>".into());
    };
    if s.contains("<w:trackRevisions") {
        s = s
            .replace(
                "<w:trackRevisions w:val=\"false\"/>",
                "<w:trackRevisions w:val=\"true\"/>",
            )
            .replace(
                "<w:trackRevisions w:val=\"false\"></w:trackRevisions>",
                "<w:trackRevisions w:val=\"true\"/>",
            );
    }
    let mut inject = String::new();
    if !s.contains("<w:trackRevisions") {
        inject.push_str("<w:trackRevisions w:val=\"true\"/>");
    }
    if !s.contains("revisionView") {
        inject.push_str(
            "<w:revisionView w:markup=\"true\" w:insDel=\"true\" w:formatting=\"true\"/>",
        );
    }
    if inject.is_empty() {
        return Ok(s.into_bytes());
    }
    let mut out = String::with_capacity(s.len() + inject.len());
    out.push_str(&s[..idx]);
    out.push_str(&inject);
    out.push_str(&s[idx..]);
    Ok(out.into_bytes())
}

pub fn inject_track_revisions_flag(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader).map_err(|e| format!("读取 DOCX 失败: {e}"))?;
    let mut out_buf = Vec::new();
    {
        let mut out_cursor = Cursor::new(&mut out_buf);
        let mut writer = ZipWriter::new(&mut out_cursor);
        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("读取 DOCX 条目失败: {e}"))?;
            let name = file.name().to_string();
            let compression = file.compression();
            let options = SimpleFileOptions::default().compression_method(compression);
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)
                .map_err(|e| format!("读取 DOCX 条目失败: {e}"))?;
            if name == "word/settings.xml" {
                buf = patch_settings_track_and_markup(buf)?;
            }
            writer
                .start_file(name, options)
                .map_err(|e| format!("写入 DOCX 失败: {e}"))?;
            writer
                .write_all(&buf)
                .map_err(|e| format!("写入 DOCX 失败: {e}"))?;
        }
        writer
            .finish()
            .map_err(|e| format!("写入 DOCX 失败: {e}"))?;
    }
    Ok(out_buf)
}

#[cfg(test)]
mod tests {
    use super::super::diff::pieces_have_markup;
    use super::*;

    #[test]
    fn line_diff_maps_to_paragraph_bucket() {
        let before = vec!["你好世界".into()];
        let after = vec!["你好，世界。".into()];
        let paras = vec!["你好，世界。".into()];
        let buckets = accumulate_line_diffs_into_paragraphs(&before, &after, &paras);
        assert!(pieces_have_markup(&buckets[0]));
    }
}

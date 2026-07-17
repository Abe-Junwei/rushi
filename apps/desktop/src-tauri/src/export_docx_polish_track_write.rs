//! 润色导出修订轨：Word 段落写入与 settings 修订开关。

use std::io::{Cursor, Read, Write};

use docx_rs::*;
use quick_xml::events::{BytesStart, Event};
use quick_xml::name::QName;
use quick_xml::{Reader, Writer};
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::export_docx::{
    add_body_paragraph, add_body_paragraph_with_comments, append_delivery_block_separator,
    append_delivery_block_time_end, append_delivery_block_time_start,
    append_polished_paragraph_list, sanitize_docx_text, DocxAnnotationComments,
    DocxDeliveryTimeBlock, ANNOTATION_COMMENT_AUTHOR, ANNOTATION_HIGHLIGHT, MAX_LECTURE_BODY_CHARS,
};

use super::diff::{
    before_lines_from_joined, diff_pieces_for_export_track, pieces_have_markup, push_del_str,
    push_ins_char, push_same_char, DiffPiece,
};

pub const POLISH_TRACK_AUTHOR: &str = "如是我闻";

fn polish_revision_date() -> String {
    chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S%:z")
        .to_string()
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
    paragraph_from_diff_pieces_with_comments(pieces, &[], author, date, None)
}

fn paragraph_from_diff_pieces_with_comments(
    pieces: &[DiffPiece],
    notes: &[String],
    author: &str,
    date: &str,
    comments: Option<&mut DocxAnnotationComments>,
) -> Paragraph {
    let highlight_same = !notes.is_empty();
    let mut para = Paragraph::new();
    let mut comment_ids = Vec::new();
    if highlight_same {
        if let Some(comments) = comments {
            let comment_date = polish_revision_date();
            for note in notes {
                let id = comments.alloc_id();
                comment_ids.push(id);
                let comment = Comment::new(id)
                    .author(ANNOTATION_COMMENT_AUTHOR)
                    .date(&comment_date)
                    .add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().size(20).add_text(sanitize_docx_text(note))),
                    );
                para = para.add_comment_start(comment);
            }
        }
    }
    for piece in pieces {
        match piece {
            DiffPiece::Same(text) if !text.is_empty() => {
                let mut run = track_body_run().add_text(sanitize_docx_text(text));
                if highlight_same {
                    run = run.highlight(ANNOTATION_HIGHLIGHT);
                }
                para = para.add_run(run);
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
    for id in comment_ids.iter().rev() {
        para = para.add_comment_end(*id);
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
#[allow(clippy::too_many_arguments)]
pub fn append_polished_with_track_changes(
    mut doc: Docx,
    annotation_comments: &mut DocxAnnotationComments,
    before_joined: &str,
    corrected_lines: &[String],
    display_paragraphs: &[String],
    paragraph_annotations: Option<&[Vec<String>]>,
    spaced: bool,
    blocks: Option<&[DocxDeliveryTimeBlock]>,
    polish_track_author: &str,
) -> Docx {
    let before_lines = before_lines_from_joined(before_joined);
    if corrected_lines.len() != before_lines.len() || before_lines.is_empty() {
        return append_polished_paragraph_list(
            doc,
            annotation_comments,
            display_paragraphs,
            paragraph_annotations,
            spaced,
            blocks,
        );
    }

    let author = polish_track_author;
    let date = polish_revision_date();
    let display = display_paragraphs_from_lines(corrected_lines, display_paragraphs);
    let buckets = accumulate_line_diffs_into_paragraphs(&before_lines, corrected_lines, &display);

    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;

    let paragraph_has_notes = |pi: usize| -> bool {
        paragraph_annotations
            .and_then(|groups| groups.get(pi))
            .is_some_and(|notes| !notes.is_empty())
    };

    let mut append_para = |doc: Docx, pi: usize, chunk: &str| -> Docx {
        let bucket = buckets.get(pi).map(Vec::as_slice).unwrap_or(&[]);
        let notes = paragraph_annotations
            .and_then(|groups| groups.get(pi))
            .map(Vec::as_slice)
            .unwrap_or(&[]);
        let notes_vec: Vec<String> = notes.to_vec();
        if !notes.is_empty() && pieces_have_markup(bucket) {
            doc.add_paragraph(paragraph_from_diff_pieces_with_comments(
                bucket,
                &notes_vec,
                author,
                &date,
                Some(annotation_comments),
            ))
        } else if !notes.is_empty() {
            add_body_paragraph_with_comments(doc, annotation_comments, chunk, notes)
        } else if pieces_have_markup(bucket) {
            doc.add_paragraph(paragraph_from_diff_pieces(bucket, author, &date))
        } else {
            add_body_paragraph(doc, chunk)
        }
    };

    if let Some(blocks) = blocks.filter(|b| !b.is_empty()) {
        let mut para_i = 0;
        for (bi, block) in blocks.iter().enumerate() {
            doc = append_delivery_block_time_start(doc, block.start_sec);
            for _ in 0..block.unit_count {
                if char_budget == 0 {
                    truncated = true;
                    break;
                }
                let Some(para_text) = display.get(para_i) else {
                    para_i += 1;
                    continue;
                };
                let t = para_text.trim();
                let pi = para_i;
                para_i += 1;
                if t.is_empty() && !paragraph_has_notes(pi) {
                    continue;
                }
                let take = if t.is_empty() {
                    0
                } else {
                    t.chars().count().min(char_budget)
                };
                let chunk: String = t.chars().take(take).collect();
                if take > 0 {
                    char_budget = char_budget.saturating_sub(take);
                }
                doc = append_para(doc, pi, &chunk);
                if spaced {
                    doc = doc.add_paragraph(Paragraph::new());
                }
                if take > 0 && take < t.chars().count() {
                    truncated = true;
                    break;
                }
            }
            doc = append_delivery_block_time_end(doc, block.end_sec);
            if bi + 1 < blocks.len() {
                doc = append_delivery_block_separator(doc);
            }
            if truncated {
                break;
            }
        }
    } else {
        for (pi, para_text) in display.iter().enumerate() {
            let t = para_text.trim();
            if t.is_empty() && !paragraph_has_notes(pi) {
                continue;
            }
            if char_budget == 0 {
                truncated = true;
                break;
            }
            let take = if t.is_empty() {
                0
            } else {
                t.chars().count().min(char_budget)
            };
            let chunk: String = t.chars().take(take).collect();
            if take > 0 {
                char_budget = char_budget.saturating_sub(take);
            }
            doc = append_para(doc, pi, &chunk);
            if spaced {
                doc = doc.add_paragraph(Paragraph::new());
            }
            if take > 0 && take < t.chars().count() {
                truncated = true;
                break;
            }
        }
    }

    if truncated {
        doc = add_body_paragraph(doc, "…（正文过长已截断，请改用「逐字稿」导出或分批导出）");
    }
    doc
}
fn track_revisions_element() -> BytesStart<'static> {
    let mut el = BytesStart::new("w:trackRevisions");
    el.push_attribute(("w:val", "true"));
    el
}

fn revision_view_element() -> BytesStart<'static> {
    let mut el = BytesStart::new("w:revisionView");
    el.push_attribute(("w:markup", "true"));
    el.push_attribute(("w:insDel", "true"));
    el.push_attribute(("w:formatting", "true"));
    el
}

/// Programmatically toggles `<w:trackRevisions>`/injects `<w:revisionView>` via
/// an XML event stream instead of string patching, so it cannot be broken by
/// attribute-order or self-closing-tag variance from `docx-rs`.
fn patch_settings_track_and_markup(xml: Vec<u8>) -> Result<Vec<u8>, String> {
    let mut reader = Reader::from_reader(xml.as_slice());
    let mut writer = Writer::new(Vec::with_capacity(xml.len() + 128));
    let mut seen_track_revisions = false;
    let mut seen_revision_view = false;
    let mut buf = Vec::new();

    loop {
        let event = reader
            .read_event_into(&mut buf)
            .map_err(|e| format!("解析 settings.xml 失败: {e}"))?;
        match event {
            Event::Eof => break,
            Event::Empty(e) if e.name() == QName(b"w:trackRevisions") => {
                seen_track_revisions = true;
                writer
                    .write_event(Event::Empty(track_revisions_element()))
                    .map_err(|e| format!("写入 settings.xml 失败: {e}"))?;
            }
            Event::Start(e) if e.name() == QName(b"w:trackRevisions") => {
                seen_track_revisions = true;
                reader
                    .read_to_end_into(e.name(), &mut Vec::new())
                    .map_err(|e| format!("解析 settings.xml 失败: {e}"))?;
                writer
                    .write_event(Event::Empty(track_revisions_element()))
                    .map_err(|e| format!("写入 settings.xml 失败: {e}"))?;
            }
            Event::Empty(e) if e.name() == QName(b"w:revisionView") => {
                seen_revision_view = true;
                writer
                    .write_event(Event::Empty(e.into_owned()))
                    .map_err(|e| format!("写入 settings.xml 失败: {e}"))?;
            }
            Event::End(e) if e.name() == QName(b"w:settings") => {
                if !seen_track_revisions {
                    writer
                        .write_event(Event::Empty(track_revisions_element()))
                        .map_err(|e| format!("写入 settings.xml 失败: {e}"))?;
                }
                if !seen_revision_view {
                    writer
                        .write_event(Event::Empty(revision_view_element()))
                        .map_err(|e| format!("写入 settings.xml 失败: {e}"))?;
                }
                writer
                    .write_event(Event::End(e.into_owned()))
                    .map_err(|e| format!("写入 settings.xml 失败: {e}"))?;
            }
            other => {
                writer
                    .write_event(other.into_owned())
                    .map_err(|e| format!("写入 settings.xml 失败: {e}"))?;
            }
        }
        buf.clear();
    }

    Ok(writer.into_inner())
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

    #[test]
    fn patch_settings_injects_when_absent() {
        let xml = br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="ns"><w:zoom w:percent="100"/></w:settings>"#.to_vec();
        let out = patch_settings_track_and_markup(xml).expect("patch should succeed");
        let s = String::from_utf8(out).unwrap();
        assert!(s.contains(r#"<w:trackRevisions w:val="true"/>"#));
        assert!(s.contains("w:revisionView"));
        assert!(s.contains(r#"w:markup="true""#));
        assert!(s.ends_with("</w:settings>"));
    }

    #[test]
    fn patch_settings_flips_existing_false_flag() {
        let xml =
            br#"<w:settings xmlns:w="ns"><w:trackRevisions w:val="false"/></w:settings>"#.to_vec();
        let out = patch_settings_track_and_markup(xml).expect("patch should succeed");
        let s = String::from_utf8(out).unwrap();
        assert!(s.contains(r#"<w:trackRevisions w:val="true"/>"#));
        assert!(!s.contains(r#"w:val="false""#));
        assert_eq!(s.matches("trackRevisions").count(), 1);
    }

    #[test]
    fn patch_settings_does_not_duplicate_existing_revision_view() {
        let xml =
            br#"<w:settings xmlns:w="ns"><w:revisionView w:markup="false"/></w:settings>"#.to_vec();
        let out = patch_settings_track_and_markup(xml).expect("patch should succeed");
        let s = String::from_utf8(out).unwrap();
        assert_eq!(s.matches("w:revisionView").count(), 1);
        assert!(s.contains(r#"<w:trackRevisions w:val="true"/>"#));
    }
}

//! DOCX body helpers — sanitize, segment appenders, paragraph builders.

use docx_rs::*;

use crate::project::SegmentDto;

#[derive(Debug, Clone, Default)]
pub(crate) struct DocxDeliveryTimeBlock {
    pub start_sec: f64,
    pub end_sec: f64,
    pub unit_count: usize,
}

/// Muted meta text — aligns with `COLORS.notionTextMuted` (#6b6b6b).
pub(crate) const DOCX_COLOR_MUTED: &str = "6B6B6B";

pub(crate) const MAX_LECTURE_BODY_CHARS: usize = 2_000_000;
const MAX_APPENDIX_LINES: usize = 120;

fn is_xml_illegal_char(c: char) -> bool {
    let cp = c as u32;
    matches!(
        cp,
        0x00..=0x08 | 0x0B | 0x0C | 0x0E..=0x1F | 0x7F..=0x84 | 0x86..=0x9F | 0xFFFE | 0xFFFF
    )
}

/// Strip XML-illegal code points; entity escaping is delegated to `docx-rs` `add_text`.
pub(crate) fn sanitize_docx_text(s: &str) -> String {
    s.chars().filter(|c| !is_xml_illegal_char(*c)).collect()
}

pub(crate) fn normalize_export_mode(mode: &str) -> &'static str {
    match mode.trim() {
        "lecture" => "lecture",
        "clean" => "clean",
        _ => "verbatim",
    }
}

pub(crate) fn format_hms(seconds: f64) -> String {
    if !seconds.is_finite() {
        return "00:00:00".to_string();
    }
    let total = seconds.max(0.0).floor() as u64;
    let h = total / 3600;
    let m = (total % 3600) / 60;
    let s = total % 60;
    format!("{h:02}:{m:02}:{s:02}")
}

pub(crate) fn sanitize_title(title: &str) -> String {
    let t = title.trim();
    if t.is_empty() {
        "未命名".to_string()
    } else {
        t.chars().take(200).collect()
    }
}

pub(crate) fn add_meta_paragraph(doc: Docx, line: &str) -> Docx {
    if line.trim().is_empty() {
        return doc;
    }
    doc.add_paragraph(
        Paragraph::new().add_run(
            Run::new()
                .size(20)
                .color(DOCX_COLOR_MUTED)
                .add_text(sanitize_docx_text(line)),
        ),
    )
}

fn add_right_meta_paragraph(doc: Docx, line: &str) -> Docx {
    if line.trim().is_empty() {
        return doc;
    }
    doc.add_paragraph(
        Paragraph::new()
            .align(AlignmentType::Right)
            .add_run(
                Run::new()
                    .size(20)
                    .color(DOCX_COLOR_MUTED)
                    .add_text(sanitize_docx_text(line)),
            ),
    )
}

fn append_block_time_start(doc: Docx, start_sec: f64) -> Docx {
    if start_sec.is_finite() {
        add_meta_paragraph(doc, &format!("起始时间：{}", format_hms(start_sec)))
    } else {
        doc
    }
}

fn append_block_time_end(doc: Docx, end_sec: f64) -> Docx {
    if end_sec.is_finite() {
        add_right_meta_paragraph(doc, &format!("结束时间：{}", format_hms(end_sec)))
    } else {
        doc
    }
}

fn append_block_separator(doc: Docx) -> Docx {
    doc.add_paragraph(Paragraph::new())
}

pub(crate) fn append_delivery_block_time_start(doc: Docx, start_sec: f64) -> Docx {
    append_block_time_start(doc, start_sec)
}

pub(crate) fn append_delivery_block_time_end(doc: Docx, end_sec: f64) -> Docx {
    append_block_time_end(doc, end_sec)
}

pub(crate) fn append_delivery_block_separator(doc: Docx) -> Docx {
    append_block_separator(doc)
}

/// 文末录音文件名、转录人与转录时间（右下角；转录时间精确到天）。
pub(crate) fn collect_export_footer_meta_lines(
    recording_file_name: Option<&str>,
    footer_transcriber_name: Option<&str>,
    footer_transcribed_at: Option<&str>,
) -> Vec<String> {
    let mut lines = Vec::new();
    let recording = recording_file_name.unwrap_or("").trim();
    lines.push(format!("录音文件名称：{recording}"));
    if let Some(name) = footer_transcriber_name {
        lines.push(format!("转录人：{}", name.trim()));
    }
    if let Some(day) = footer_transcribed_at.map(str::trim).filter(|s| !s.is_empty()) {
        lines.push(format!("转录时间：{day}"));
    }
    lines
}

/// 文末元信息：右下角对齐，每行一条。
pub(crate) fn append_export_footer_meta(doc: Docx, lines: &[String]) -> Docx {
    if lines.is_empty() {
        return doc;
    }
    let mut doc = doc.add_paragraph(Paragraph::new());
    for line in lines {
        doc = add_right_meta_paragraph(doc, line);
    }
    doc
}

pub(crate) fn add_body_paragraph(doc: Docx, text: &str) -> Docx {
    doc.add_paragraph(
        Paragraph::new().add_run(Run::new().size(24).add_text(sanitize_docx_text(text))),
    )
}

/// 讲稿：连续块右侧标起止时码；块间空行分隔。
pub(crate) fn append_lecture_segments(
    doc: Docx,
    segments: &[SegmentDto],
    blocks: Option<&[DocxDeliveryTimeBlock]>,
) -> Docx {
    if let Some(blocks) = blocks.filter(|b| !b.is_empty()) {
        let mut doc = doc;
        let mut char_budget = MAX_LECTURE_BODY_CHARS;
        let mut truncated = false;
        let mut seg_i = 0;
        for (bi, block) in blocks.iter().enumerate() {
            doc = append_block_time_start(doc, block.start_sec);
            for _ in 0..block.unit_count {
                if char_budget == 0 {
                    truncated = true;
                    break;
                }
                while seg_i < segments.len() && segments[seg_i].text.trim().is_empty() {
                    seg_i += 1;
                }
                let Some(s) = segments.get(seg_i) else {
                    break;
                };
                seg_i += 1;
                let t = s.text.trim();
                let take = t.chars().count().min(char_budget);
                let chunk: String = t.chars().take(take).collect();
                char_budget = char_budget.saturating_sub(take);
                doc = add_body_paragraph(doc, &chunk);
                if take < t.chars().count() {
                    truncated = true;
                    break;
                }
            }
            doc = append_block_time_end(doc, block.end_sec);
            if bi + 1 < blocks.len() {
                doc = append_block_separator(doc);
            }
            if truncated {
                break;
            }
        }
        if truncated {
            doc = add_body_paragraph(doc, "…（正文过长已截断，请改用「逐字稿」导出或分批导出）");
        }
        return doc;
    }

    let mut doc = doc;
    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;
    for s in segments {
        let t = s.text.trim();
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
        doc = add_body_paragraph(doc, &chunk);
        if take < t.chars().count() {
            truncated = true;
            break;
        }
    }
    if truncated {
        doc = add_body_paragraph(doc, "…（正文过长已截断，请改用「逐字稿」导出或分批导出）");
    }
    doc
}

pub(crate) fn append_clean_segments_with_blocks(
    doc: Docx,
    segments: &[SegmentDto],
    blocks: Option<&[DocxDeliveryTimeBlock]>,
) -> Docx {
    if let Some(blocks) = blocks.filter(|b| !b.is_empty()) {
        let mut doc = doc;
        let mut char_budget = MAX_LECTURE_BODY_CHARS;
        let mut truncated = false;
        let mut seg_i = 0;
        for (bi, block) in blocks.iter().enumerate() {
            doc = append_block_time_start(doc, block.start_sec);
            for _ in 0..block.unit_count {
                if char_budget == 0 {
                    truncated = true;
                    break;
                }
                while seg_i < segments.len() && segments[seg_i].text.trim().is_empty() {
                    seg_i += 1;
                }
                let Some(s) = segments.get(seg_i) else {
                    break;
                };
                seg_i += 1;
                let t = s.text.trim();
                let take = t.chars().count().min(char_budget);
                let chunk: String = t.chars().take(take).collect();
                char_budget = char_budget.saturating_sub(take);
                doc = add_body_paragraph(doc, &chunk);
                doc = doc.add_paragraph(Paragraph::new());
                if take < t.chars().count() {
                    truncated = true;
                    break;
                }
            }
            doc = append_block_time_end(doc, block.end_sec);
            if bi + 1 < blocks.len() {
                doc = append_block_separator(doc);
            }
            if truncated {
                break;
            }
        }
        if truncated {
            doc = add_body_paragraph(doc, "…（正文过长已截断，请改用「逐字稿」导出或分批导出）");
        }
        return doc;
    }
    append_clean_segments(doc, segments)
}

pub(crate) fn append_verbatim_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
    let mut doc = doc;
    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;
    for s in segments {
        let t = s.text.trim();
        if t.is_empty() {
            continue;
        }
        if char_budget == 0 {
            truncated = true;
            break;
        }
        let meta = format!("[{} – {}]", format_hms(s.start_sec), format_hms(s.end_sec));
        doc = doc.add_paragraph(
            Paragraph::new().add_run(
                Run::new()
                    .size(20)
                    .color(DOCX_COLOR_MUTED)
                    .add_text(sanitize_docx_text(&meta)),
            ),
        );
        let take = t.chars().count().min(char_budget);
        let chunk: String = t.chars().take(take).collect();
        char_budget = char_budget.saturating_sub(take);
        doc = add_body_paragraph(doc, &chunk);
        doc = doc.add_paragraph(Paragraph::new());
        if take < t.chars().count() {
            truncated = true;
            break;
        }
    }
    if truncated {
        doc = add_body_paragraph(doc, "…（正文过长已截断，请分批导出）");
    }
    doc
}

pub(crate) fn append_clean_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
    let mut doc = doc;
    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;
    for s in segments {
        let t = s.text.trim();
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
        doc = add_body_paragraph(doc, &chunk);
        doc = doc.add_paragraph(Paragraph::new());
        if take < t.chars().count() {
            truncated = true;
            break;
        }
    }
    if truncated {
        doc = add_body_paragraph(doc, "…（正文过长已截断，请改用「逐字稿」导出或分批导出）");
    }
    doc
}

/// 润色段落：连续块右侧标起止时码；块间空行（干净稿段后亦保留空行）。
pub(crate) fn append_polished_paragraph_list(
    doc: Docx,
    paragraphs: &[String],
    spaced: bool,
    blocks: Option<&[DocxDeliveryTimeBlock]>,
) -> Docx {
    if let Some(blocks) = blocks.filter(|b| !b.is_empty()) {
        let mut doc = doc;
        let mut char_budget = MAX_LECTURE_BODY_CHARS;
        let mut truncated = false;
        let mut para_i = 0;
        for (bi, block) in blocks.iter().enumerate() {
            doc = append_block_time_start(doc, block.start_sec);
            for _ in 0..block.unit_count {
                if char_budget == 0 {
                    truncated = true;
                    break;
                }
                let Some(p) = paragraphs.get(para_i) else {
                    para_i += 1;
                    continue;
                };
                para_i += 1;
                let t = p.trim();
                if t.is_empty() {
                    continue;
                }
                let take = t.chars().count().min(char_budget);
                let chunk: String = t.chars().take(take).collect();
                char_budget = char_budget.saturating_sub(take);
                doc = add_body_paragraph(doc, &chunk);
                if spaced {
                    doc = doc.add_paragraph(Paragraph::new());
                }
                if take < t.chars().count() {
                    truncated = true;
                    break;
                }
            }
            doc = append_block_time_end(doc, block.end_sec);
            if bi + 1 < blocks.len() {
                doc = append_block_separator(doc);
            }
            if truncated {
                break;
            }
        }
        if truncated {
            doc = add_body_paragraph(doc, "…（正文过长已截断，请改用「逐字稿」导出或分批导出）");
        }
        return doc;
    }

    let mut doc = doc;
    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;
    for p in paragraphs {
        let t = p.trim();
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
        doc = add_body_paragraph(doc, &chunk);
        if spaced {
            doc = doc.add_paragraph(Paragraph::new());
        }
        if take < t.chars().count() {
            truncated = true;
            break;
        }
    }
    if truncated {
        doc = add_body_paragraph(doc, "…（正文过长已截断，请改用「逐字稿」导出或分批导出）");
    }
    doc
}

pub(crate) fn append_revision_appendix(doc: Docx, lines: &[String]) -> Docx {
    if lines.is_empty() {
        return doc;
    }
    let mut doc = doc;
    doc = doc.add_paragraph(Paragraph::new());
    doc = doc.add_paragraph(
        Paragraph::new().add_run(Run::new().bold().size(28).add_text("附录：修订摘要")),
    );
    doc = doc.add_paragraph(Paragraph::new());
    let cap = lines.len().min(MAX_APPENDIX_LINES);
    for line in &lines[..cap] {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        doc = doc.add_paragraph(
            Paragraph::new().add_run(
                Run::new()
                    .size(20)
                    .color(DOCX_COLOR_MUTED)
                    .add_text(sanitize_docx_text(t)),
            ),
        );
    }
    doc
}

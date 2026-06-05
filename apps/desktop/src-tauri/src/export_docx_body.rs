//! DOCX body helpers — sanitize, segment appenders, paragraph builders.

use docx_rs::*;

use crate::project::SegmentDto;

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

pub(crate) fn add_body_paragraph(doc: Docx, text: &str) -> Docx {
    doc.add_paragraph(
        Paragraph::new().add_run(Run::new().size(24).add_text(sanitize_docx_text(text))),
    )
}

pub(crate) fn append_verbatim_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
    let mut doc = doc;
    for s in segments {
        let t = s.text.trim();
        if t.is_empty() {
            continue;
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
        doc = add_body_paragraph(doc, t);
        doc = doc.add_paragraph(Paragraph::new());
    }
    doc
}

pub(crate) fn append_clean_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
    let mut doc = doc;
    for s in segments {
        let t = s.text.trim();
        if t.is_empty() {
            continue;
        }
        doc = add_body_paragraph(doc, t);
        doc = doc.add_paragraph(Paragraph::new());
    }
    doc
}

/// 大模型润色后的段落列表；`spaced` 为 true 时段后插空行（干净稿版式）。
pub(crate) fn append_polished_paragraph_list(
    doc: Docx,
    paragraphs: &[String],
    spaced: bool,
) -> Docx {
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

/// 讲稿：按语段各占一个 Word 自然段（无时间码）；过长时截断并提示。
pub(crate) fn append_lecture_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
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

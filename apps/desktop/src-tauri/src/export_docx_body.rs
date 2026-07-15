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

/// Word 批注作者名（右侧修订/批注栏）。
pub(crate) const ANNOTATION_COMMENT_AUTHOR: &str = "备注";

/// 有备注的语段正文高亮色（Word 具名颜色）。
pub(crate) const ANNOTATION_HIGHLIGHT: &str = "yellow";

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

/// Word 修订作者名：去非法字符并截断（干净稿用模型名）。
pub(crate) fn sanitize_polish_track_author(author: &str) -> String {
    let s = sanitize_docx_text(author.trim());
    s.chars().take(80).collect()
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
        Paragraph::new().align(AlignmentType::Right).add_run(
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
    if let Some(day) = footer_transcribed_at
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
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

fn trimmed_segment_annotation(annotation: Option<&str>) -> Option<&str> {
    annotation.and_then(|a| {
        let t = a.trim();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

/// 正文或备注至少一项非空时导出该语段（与 TXT `（备注）` 对齐）。
pub(crate) fn segment_has_exportable_content(s: &SegmentDto) -> bool {
    !s.text.trim().is_empty()
        || trimmed_segment_annotation(s.annotation.as_deref()).is_some()
}

/// 与 TS `segmentLinesFromSegments` 一致：仅非空正文语段的下标。
pub(crate) fn non_empty_segment_indices(segments: &[SegmentDto]) -> Vec<usize> {
    segments
        .iter()
        .enumerate()
        .filter(|(_, s)| !s.text.trim().is_empty())
        .map(|(i, _)| i)
        .collect()
}

#[cfg(test)]
pub(crate) fn segments_have_annotations(segments: &[SegmentDto]) -> bool {
    segments
        .iter()
        .any(|s| trimmed_segment_annotation(s.annotation.as_deref()).is_some())
}

fn annotation_comment_date() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%:z").to_string()
}

fn flatten_for_annotation_map(s: &str) -> String {
    s.chars().filter(|c| *c != '\n' && *c != '\r').collect()
}

/// 分配 Word 批注 id（`comments.xml` + 正文 `commentRange`）。
#[derive(Debug, Default)]
pub(crate) struct DocxAnnotationComments {
    next_id: usize,
}

impl DocxAnnotationComments {
    pub(crate) fn alloc_id(&mut self) -> usize {
        self.next_id += 1;
        self.next_id
    }
}

/// 润色/合并自然段时，按扁平字符边界将语段行映射到各自然段（避免合并后丢备注）。
pub(crate) fn line_indices_per_polish_paragraph(
    lines: &[String],
    paragraphs: &[String],
) -> Vec<Vec<usize>> {
    let mut groups: Vec<Vec<usize>> = paragraphs.iter().map(|_| Vec::new()).collect();
    if lines.is_empty() || paragraphs.is_empty() {
        return groups;
    }
    let lines_flat: String = lines.iter().map(|s| s.as_str()).collect();
    let paras_flat: String = paragraphs.iter().map(|s| s.as_str()).collect();
    if flatten_for_annotation_map(&lines_flat) != flatten_for_annotation_map(&paras_flat) {
        if lines.len() == paragraphs.len() {
            return (0..lines.len()).map(|i| vec![i]).collect();
        }
        return groups;
    }
    let mut line_i = 0usize;
    for (pi, para) in paragraphs.iter().enumerate() {
        let need = flatten_for_annotation_map(para).chars().count();
        let mut got = 0usize;
        while line_i < lines.len() && (got < need || groups[pi].is_empty()) {
            groups[pi].push(line_i);
            got += lines[line_i].chars().count();
            line_i += 1;
            if got >= need {
                break;
            }
        }
    }
    groups
}

pub(crate) fn annotations_grouped_by_polish_paragraphs(
    lines: &[String],
    paragraphs: &[String],
    segments: &[SegmentDto],
) -> Vec<Vec<String>> {
    let segment_index_for_line = non_empty_segment_indices(segments);
    line_indices_per_polish_paragraph(lines, paragraphs)
        .into_iter()
        .map(|line_indices| {
            line_indices
                .into_iter()
                .filter_map(|line_i| {
                    segment_index_for_line.get(line_i).and_then(|&seg_i| {
                        segments.get(seg_i).and_then(|s| {
                            trimmed_segment_annotation(s.annotation.as_deref())
                                .map(|t| t.to_string())
                        })
                    })
                })
                .collect()
        })
        .collect()
}

fn build_body_paragraph_with_comments(text: &str, notes: &[String], comments: &mut DocxAnnotationComments) -> Paragraph {
    let mut para = Paragraph::new();
    let mut ids = Vec::with_capacity(notes.len());
    let date = annotation_comment_date();
    for note in notes {
        let id = comments.alloc_id();
        ids.push(id);
        let comment = Comment::new(id)
            .author(ANNOTATION_COMMENT_AUTHOR)
            .date(&date)
            .add_paragraph(
                Paragraph::new().add_run(
                    Run::new()
                        .size(20)
                        .add_text(sanitize_docx_text(note)),
                ),
            );
        para = para.add_comment_start(comment);
    }
    para = para.add_run(
        Run::new()
            .size(24)
            .highlight(ANNOTATION_HIGHLIGHT)
            .add_text(sanitize_docx_text(text)),
    );
    for id in ids.iter().rev() {
        para = para.add_comment_end(*id);
    }
    para
}

/// 正文段落：有备注时高亮全文，并以 Word 批注显示在右侧修订栏（非内联 w:ins）。
pub(crate) fn add_body_paragraph_with_comments(
    doc: Docx,
    comments: &mut DocxAnnotationComments,
    text: &str,
    notes: &[String],
) -> Docx {
    if notes.is_empty() {
        return add_body_paragraph(doc, text);
    }
    doc.add_paragraph(build_body_paragraph_with_comments(text, notes, comments))
}

fn segment_notes(annotation: Option<&str>) -> Vec<String> {
    trimmed_segment_annotation(annotation)
        .map(|t| vec![t.to_string()])
        .unwrap_or_default()
}

/// 讲稿：连续块右侧标起止时码；块间空行分隔。
pub(crate) fn append_lecture_segments(
    doc: Docx,
    comments: &mut DocxAnnotationComments,
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
                while seg_i < segments.len() && !segment_has_exportable_content(&segments[seg_i]) {
                    seg_i += 1;
                }
                let Some(s) = segments.get(seg_i) else {
                    break;
                };
                seg_i += 1;
                let t = s.text.trim();
                let notes = segment_notes(s.annotation.as_deref());
                let take = if t.is_empty() {
                    0
                } else {
                    t.chars().count().min(char_budget)
                };
                let chunk: String = t.chars().take(take).collect();
                if take > 0 {
                    char_budget = char_budget.saturating_sub(take);
                }
                doc = add_body_paragraph_with_comments(doc, comments, &chunk, &notes);
                if take > 0 && take < t.chars().count() {
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
        if !segment_has_exportable_content(s) {
            continue;
        }
        let t = s.text.trim();
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
        doc = add_body_paragraph_with_comments(
            doc,
            comments,
            &chunk,
            &segment_notes(s.annotation.as_deref()),
        );
        if take > 0 && take < t.chars().count() {
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
    comments: &mut DocxAnnotationComments,
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
                while seg_i < segments.len() && !segment_has_exportable_content(&segments[seg_i]) {
                    seg_i += 1;
                }
                let Some(s) = segments.get(seg_i) else {
                    break;
                };
                seg_i += 1;
                let t = s.text.trim();
                let notes = segment_notes(s.annotation.as_deref());
                let take = if t.is_empty() {
                    0
                } else {
                    t.chars().count().min(char_budget)
                };
                let chunk: String = t.chars().take(take).collect();
                if take > 0 {
                    char_budget = char_budget.saturating_sub(take);
                }
                doc = add_body_paragraph_with_comments(doc, comments, &chunk, &notes);
                doc = doc.add_paragraph(Paragraph::new());
                if take > 0 && take < t.chars().count() {
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
    append_clean_segments(doc, comments, segments)
}

pub(crate) fn append_verbatim_segments(
    doc: Docx,
    comments: &mut DocxAnnotationComments,
    segments: &[SegmentDto],
) -> Docx {
    let mut doc = doc;
    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;
    for s in segments {
        if !segment_has_exportable_content(s) {
            continue;
        }
        let t = s.text.trim();
        if char_budget == 0 {
            truncated = true;
            break;
        }
        if !t.is_empty() {
            let meta = format!("[{} – {}]", format_hms(s.start_sec), format_hms(s.end_sec));
            doc = doc.add_paragraph(
                Paragraph::new().add_run(
                    Run::new()
                        .size(20)
                        .color(DOCX_COLOR_MUTED)
                        .add_text(sanitize_docx_text(&meta)),
                ),
            );
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
        doc = add_body_paragraph_with_comments(
            doc,
            comments,
            &chunk,
            &segment_notes(s.annotation.as_deref()),
        );
        doc = doc.add_paragraph(Paragraph::new());
        if take > 0 && take < t.chars().count() {
            truncated = true;
            break;
        }
    }
    if truncated {
        doc = add_body_paragraph(doc, "…（正文过长已截断，请分批导出）");
    }
    doc
}

pub(crate) fn append_clean_segments(
    doc: Docx,
    comments: &mut DocxAnnotationComments,
    segments: &[SegmentDto],
) -> Docx {
    let mut doc = doc;
    let mut char_budget = MAX_LECTURE_BODY_CHARS;
    let mut truncated = false;
    for s in segments {
        if !segment_has_exportable_content(s) {
            continue;
        }
        let t = s.text.trim();
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
        doc = add_body_paragraph_with_comments(
            doc,
            comments,
            &chunk,
            &segment_notes(s.annotation.as_deref()),
        );
        doc = doc.add_paragraph(Paragraph::new());
        if take > 0 && take < t.chars().count() {
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
    comments: &mut DocxAnnotationComments,
    paragraphs: &[String],
    paragraph_annotations: Option<&[Vec<String>]>,
    spaced: bool,
    blocks: Option<&[DocxDeliveryTimeBlock]>,
) -> Docx {
    let notes_for = |para_i: usize| -> &[String] {
        paragraph_annotations
            .and_then(|groups| groups.get(para_i))
            .map(Vec::as_slice)
            .unwrap_or(&[])
    };

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
                let notes = notes_for(para_i - 1);
                if t.is_empty() && notes.is_empty() {
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
                doc = add_body_paragraph_with_comments(doc, comments, &chunk, notes);
                if spaced {
                    doc = doc.add_paragraph(Paragraph::new());
                }
                if take > 0 && take < t.chars().count() {
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
    for (para_i, p) in paragraphs.iter().enumerate() {
        let t = p.trim();
        let notes = notes_for(para_i);
        if t.is_empty() && notes.is_empty() {
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
        doc = add_body_paragraph_with_comments(doc, comments, &chunk, notes);
        if spaced {
            doc = doc.add_paragraph(Paragraph::new());
        }
        if take > 0 && take < t.chars().count() {
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

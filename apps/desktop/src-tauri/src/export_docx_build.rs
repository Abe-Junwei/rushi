use std::io::Cursor;

use docx_rs::*;

use crate::export_docx_polish_track::{append_polished_with_track_changes, inject_track_revisions_flag};
use crate::project::SegmentDto;

use super::export_docx_body::{
    add_meta_paragraph, append_clean_segments, append_lecture_segments,
    append_polished_paragraph_list, append_revision_appendix, append_verbatim_segments,
    normalize_export_mode, sanitize_docx_text, sanitize_title,
};

fn should_use_polish_track_changes(
    polish_track_changes: bool,
    polished_paragraphs: Option<&[String]>,
    polish_before_joined: Option<&str>,
    polish_corrected_lines: Option<&[String]>,
) -> bool {
    if !polish_track_changes {
        return false;
    }
    let Some(after) = polished_paragraphs else {
        return false;
    };
    let Some(before) = polish_before_joined.map(str::trim).filter(|s| !s.is_empty()) else {
        return false;
    };
    let Some(lines) = polish_corrected_lines.filter(|l| !l.is_empty()) else {
        return false;
    };
    if !after.iter().any(|x| !x.trim().is_empty()) || before.is_empty() {
        return false;
    }
    lines.len() == crate::export_docx_polish_track::before_lines_from_joined(before).len()
}

pub(crate) fn build_docx_bytes(
    title: &str,
    export_mode: &str,
    segments: &[SegmentDto],
    export_meta_line: Option<&str>,
    appendix_lines: &[String],
    polished_paragraphs: Option<&[String]>,
    polish_before_joined: Option<&str>,
    polish_corrected_lines: Option<&[String]>,
    polish_track_changes: bool,
) -> Result<Vec<u8>, String> {
    let mode = normalize_export_mode(export_mode);
    let any_text = segments.iter().any(|s| !s.text.trim().is_empty());
    let has_polished = polished_paragraphs
        .is_some_and(|p| p.iter().any(|x| !x.trim().is_empty()));
    let track_requested = polish_track_changes;
    let use_track = should_use_polish_track_changes(
        polish_track_changes,
        polished_paragraphs,
        polish_before_joined,
        polish_corrected_lines,
    );

    let mut effective_meta = export_meta_line.map(str::to_string);
    if track_requested && has_polished && !use_track {
        let note = "（未写入 Word 修订轨：语段行数与润色前未对齐，正文为润色定稿。）";
        effective_meta = Some(match effective_meta {
            Some(m) if !m.trim().is_empty() => format!("{m}\n{note}"),
            _ => note.to_string(),
        });
    }

    let mut doc = Docx::new();
    doc = doc.add_paragraph(
        Paragraph::new().add_run(
            Run::new()
                .bold()
                .size(40)
                .add_text(sanitize_docx_text(&sanitize_title(title))),
        ),
    );
    if let Some(ref meta) = effective_meta {
        doc = add_meta_paragraph(doc, meta);
    }
    doc = doc.add_paragraph(Paragraph::new());

    doc = match mode {
        "lecture" => {
            if use_track {
                let before = polish_before_joined.unwrap_or("");
                let lines = polish_corrected_lines.unwrap_or(&[]);
                let after = polished_paragraphs.unwrap_or(&[]);
                append_polished_with_track_changes(doc, before, lines, after, false)
            } else if let Some(paras) = polished_paragraphs.filter(|p| !p.is_empty()) {
                append_polished_paragraph_list(doc, paras, false)
            } else {
                append_lecture_segments(doc, segments)
            }
        }
        "clean" => {
            if use_track {
                let before = polish_before_joined.unwrap_or("");
                let lines = polish_corrected_lines.unwrap_or(&[]);
                let after = polished_paragraphs.unwrap_or(&[]);
                append_polished_with_track_changes(doc, before, lines, after, true)
            } else if let Some(paras) = polished_paragraphs.filter(|p| !p.is_empty()) {
                append_polished_paragraph_list(doc, paras, true)
            } else {
                append_clean_segments(doc, segments)
            }
        }
        _ => append_verbatim_segments(doc, segments),
    };
    if !any_text && !has_polished {
        doc = doc.add_paragraph(
            Paragraph::new().add_run(Run::new().size(24).add_text("（无正文）")),
        );
    }

    doc = append_revision_appendix(doc, appendix_lines);

    let mut buf = Vec::new();
    let mut cur = Cursor::new(&mut buf);
    doc.build()
        .pack(&mut cur)
        .map_err(|e| format!("生成 DOCX 失败: {e}"))?;
    if use_track {
        buf = inject_track_revisions_flag(&buf)?;
    }
    Ok(buf)
}

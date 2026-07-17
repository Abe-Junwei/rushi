#[cfg(test)]
use std::io::Cursor;
use std::io::{Seek, Write};
use std::path::Path;

use docx_rs::*;

use crate::export_docx_polish_track::{
    append_polished_with_track_changes, inject_track_revisions_flag,
};
use crate::project::SegmentDto;

use super::export_docx_body::{
    add_meta_paragraph, annotations_grouped_by_polish_paragraphs,
    append_clean_segments_with_blocks, append_export_footer_meta, append_lecture_segments,
    append_polished_paragraph_list, append_revision_appendix, append_verbatim_segments,
    collect_export_footer_meta_lines, normalize_export_mode, sanitize_docx_text,
    sanitize_polish_track_author, sanitize_title, DocxAnnotationComments, DocxDeliveryTimeBlock,
};

use crate::export_docx_polish_track::POLISH_TRACK_AUTHOR;

fn resolve_polish_track_author(export_mode: &str, override_author: Option<&str>) -> String {
    if normalize_export_mode(export_mode) == "clean" {
        if let Some(author) = override_author.map(str::trim).filter(|s| !s.is_empty()) {
            return sanitize_polish_track_author(author);
        }
    }
    POLISH_TRACK_AUTHOR.to_string()
}

#[derive(Default, Clone)]
pub(crate) struct DocxExportLayout {
    pub delivery_time_blocks: Vec<DocxDeliveryTimeBlock>,
    pub recording_file_name: Option<String>,
    /// `None` = omit transcriber line; `Some(s)` = write line (`s` may be empty).
    pub footer_transcriber_name: Option<String>,
    /// 文末转录时间（`YYYY-MM-DD`）；`None` = omit.
    pub footer_transcribed_at: Option<String>,
}

fn layout_time_blocks(layout: &DocxExportLayout) -> Option<&[DocxDeliveryTimeBlock]> {
    if layout.delivery_time_blocks.is_empty() {
        None
    } else {
        Some(layout.delivery_time_blocks.as_slice())
    }
}

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
    let Some(before) = polish_before_joined
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
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

#[allow(clippy::too_many_arguments)]
pub(crate) fn build_docx_to_path(
    path: &Path,
    title: &str,
    export_mode: &str,
    segments: &[SegmentDto],
    export_meta_line: Option<&str>,
    appendix_lines: &[String],
    polished_paragraphs: Option<&[String]>,
    polish_before_joined: Option<&str>,
    polish_corrected_lines: Option<&[String]>,
    polish_track_changes: bool,
    polish_track_author: Option<&str>,
    layout: &DocxExportLayout,
) -> Result<(), String> {
    // Write to a sibling `.tmp` file and `rename` into place at the end, so a
    // crash/interrupt mid-write can never leave a corrupted DOCX at `path`.
    let tmp_path = path.with_extension("docx.tmp");
    let result = (|| -> Result<(), String> {
        let file =
            std::fs::File::create(&tmp_path).map_err(|e| format!("创建 DOCX 临时文件失败: {e}"))?;
        let mut writer = std::io::BufWriter::new(file);
        build_docx_into_writer(
            &mut writer,
            title,
            export_mode,
            segments,
            export_meta_line,
            appendix_lines,
            polished_paragraphs,
            polish_before_joined,
            polish_corrected_lines,
            polish_track_changes,
            polish_track_author,
            layout,
        )?;
        writer.flush().map_err(|e| format!("写入 DOCX 失败: {e}"))?;
        drop(writer);
        if should_use_polish_track_changes(
            polish_track_changes,
            polished_paragraphs,
            polish_before_joined,
            polish_corrected_lines,
        ) {
            let bytes = std::fs::read(&tmp_path).map_err(|e| format!("读取 DOCX 失败: {e}"))?;
            let patched = inject_track_revisions_flag(&bytes)?;
            std::fs::write(&tmp_path, &patched)
                .map_err(|e| format!("写入修订轨 DOCX 失败: {e}"))?;
        }
        std::fs::rename(&tmp_path, path).map_err(|e| format!("重命名 DOCX 文件失败: {e}"))
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp_path);
    }
    result
}

#[cfg(test)]
#[allow(clippy::too_many_arguments)]
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
    polish_track_author: Option<&str>,
    layout: &DocxExportLayout,
) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    let mut cur = Cursor::new(&mut buf);
    build_docx_into_writer(
        &mut cur,
        title,
        export_mode,
        segments,
        export_meta_line,
        appendix_lines,
        polished_paragraphs,
        polish_before_joined,
        polish_corrected_lines,
        polish_track_changes,
        polish_track_author,
        layout,
    )?;
    if should_use_polish_track_changes(
        polish_track_changes,
        polished_paragraphs,
        polish_before_joined,
        polish_corrected_lines,
    ) {
        return inject_track_revisions_flag(&buf);
    }
    Ok(buf)
}

#[allow(clippy::too_many_arguments)]
fn build_docx_into_writer<W: Write + Seek>(
    writer: &mut W,
    title: &str,
    export_mode: &str,
    segments: &[SegmentDto],
    export_meta_line: Option<&str>,
    appendix_lines: &[String],
    polished_paragraphs: Option<&[String]>,
    polish_before_joined: Option<&str>,
    polish_corrected_lines: Option<&[String]>,
    polish_track_changes: bool,
    polish_track_author: Option<&str>,
    layout: &DocxExportLayout,
) -> Result<(), String> {
    let mode = normalize_export_mode(export_mode);
    let _is_lecture_or_clean = mode == "lecture" || mode == "clean";
    let polish_author = resolve_polish_track_author(export_mode, polish_track_author);
    let any_text = segments.iter().any(|s| !s.text.trim().is_empty());
    let has_polished = polished_paragraphs.is_some_and(|p| p.iter().any(|x| !x.trim().is_empty()));
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
        for line in meta.lines().map(str::trim).filter(|line| !line.is_empty()) {
            doc = add_meta_paragraph(doc, line);
        }
    }
    doc = doc.add_paragraph(Paragraph::new());

    let mut annotation_comments = DocxAnnotationComments::default();
    let polish_paragraph_annotations = if let (Some(lines), Some(paras)) = (
        polish_corrected_lines.filter(|l| !l.is_empty()),
        polished_paragraphs.filter(|p| !p.is_empty()),
    ) {
        Some(annotations_grouped_by_polish_paragraphs(
            lines, paras, segments,
        ))
    } else {
        None
    };

    let time_blocks = layout_time_blocks(layout);
    doc = match mode {
        "lecture" => {
            if use_track {
                let before = polish_before_joined.unwrap_or("");
                let lines = polish_corrected_lines.unwrap_or(&[]);
                let after = polished_paragraphs.unwrap_or(&[]);
                append_polished_with_track_changes(
                    doc,
                    &mut annotation_comments,
                    before,
                    lines,
                    after,
                    polish_paragraph_annotations.as_deref(),
                    false,
                    time_blocks,
                    &polish_author,
                )
            } else if let Some(paras) = polished_paragraphs.filter(|p| !p.is_empty()) {
                append_polished_paragraph_list(
                    doc,
                    &mut annotation_comments,
                    paras,
                    polish_paragraph_annotations.as_deref(),
                    false,
                    time_blocks,
                )
            } else {
                append_lecture_segments(doc, &mut annotation_comments, segments, time_blocks)
            }
        }
        "clean" => {
            if use_track {
                let before = polish_before_joined.unwrap_or("");
                let lines = polish_corrected_lines.unwrap_or(&[]);
                let after = polished_paragraphs.unwrap_or(&[]);
                append_polished_with_track_changes(
                    doc,
                    &mut annotation_comments,
                    before,
                    lines,
                    after,
                    polish_paragraph_annotations.as_deref(),
                    true,
                    time_blocks,
                    &polish_author,
                )
            } else if let Some(paras) = polished_paragraphs.filter(|p| !p.is_empty()) {
                append_polished_paragraph_list(
                    doc,
                    &mut annotation_comments,
                    paras,
                    polish_paragraph_annotations.as_deref(),
                    true,
                    time_blocks,
                )
            } else {
                append_clean_segments_with_blocks(
                    doc,
                    &mut annotation_comments,
                    segments,
                    time_blocks,
                )
            }
        }
        _ => append_verbatim_segments(doc, &mut annotation_comments, segments),
    };
    if !any_text && !has_polished {
        doc =
            doc.add_paragraph(Paragraph::new().add_run(Run::new().size(24).add_text("（无正文）")));
    }

    doc = append_revision_appendix(doc, appendix_lines);

    let footer_lines = collect_export_footer_meta_lines(
        layout.recording_file_name.as_deref(),
        layout.footer_transcriber_name.as_deref(),
        layout.footer_transcribed_at.as_deref(),
    );
    doc = append_export_footer_meta(doc, &footer_lines);

    doc.build()
        .pack(writer)
        .map_err(|e| format!("生成 DOCX 失败: {e}"))?;
    Ok(())
}

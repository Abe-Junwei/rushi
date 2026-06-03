//! EXP-WORD: delivery DOCX export — 逐字稿 / 讲稿 / 干净稿 + optional revision appendix.

use std::fs;
use std::io::Cursor;

use docx_rs::*;

use crate::export_docx_polish_track::{append_polished_with_track_changes, inject_track_revisions_flag};
use crate::project::SegmentDto;

/// Muted meta text — aligns with `COLORS.notionTextMuted` (#6b6b6b).
pub(crate) const DOCX_COLOR_MUTED: &str = "6B6B6B";
/// Low-confidence highlight — Word named color (see DESIGN.md / tokens).
pub(crate) const DOCX_HIGHLIGHT_LOW_CONFIDENCE: &str = "yellow";

fn is_xml_illegal_char(c: char) -> bool {
    let cp = c as u32;
    matches!(
        cp,
        0x00..=0x08 | 0x0B | 0x0C | 0x0E..=0x1F | 0x7F..=0x84 | 0x86..=0x9F | 0xFFFE | 0xFFFF
    )
}

/// Strip XML-illegal code points; entity escaping is delegated to `docx-rs` `add_text`.
pub(crate) fn sanitize_docx_text(s: &str) -> String {
    s.chars()
        .filter(|c| !is_xml_illegal_char(*c))
        .collect()
}

pub(crate) const MAX_LECTURE_BODY_CHARS: usize = 2_000_000;
const MAX_APPENDIX_LINES: usize = 120;

fn normalize_export_mode(mode: &str) -> &'static str {
    match mode.trim() {
        "lecture" => "lecture",
        "clean" => "clean",
        _ => "verbatim",
    }
}

fn format_hms(seconds: f64) -> String {
    if !seconds.is_finite() {
        return "00:00:00".to_string();
    }
    let total = seconds.max(0.0).floor() as u64;
    let h = total / 3600;
    let m = (total % 3600) / 60;
    let s = total % 60;
    format!("{h:02}:{m:02}:{s:02}")
}

fn sanitize_title(title: &str) -> String {
    let t = title.trim();
    if t.is_empty() {
        "未命名".to_string()
    } else {
        t.chars().take(200).collect()
    }
}

fn add_meta_paragraph(doc: Docx, line: &str) -> Docx {
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

pub(crate) fn add_body_paragraph(doc: Docx, text: &str, low_confidence: bool) -> Docx {
    let mut run = Run::new()
        .size(24)
        .add_text(sanitize_docx_text(text));
    if low_confidence {
        run = run.highlight(DOCX_HIGHLIGHT_LOW_CONFIDENCE);
    }
    doc.add_paragraph(Paragraph::new().add_run(run))
}

fn append_verbatim_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
    let mut doc = doc;
    for s in segments {
        let t = s.text.trim();
        if t.is_empty() {
            continue;
        }
        let meta = format!(
            "[{} – {}]",
            format_hms(s.start_sec),
            format_hms(s.end_sec)
        );
        doc = doc.add_paragraph(
            Paragraph::new().add_run(
                Run::new()
                    .size(20)
                    .color(DOCX_COLOR_MUTED)
                    .add_text(sanitize_docx_text(&meta)),
            ),
        );
        doc = add_body_paragraph(doc, t, s.low_confidence);
        doc = doc.add_paragraph(Paragraph::new());
    }
    doc
}

fn append_clean_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
    let mut doc = doc;
    for s in segments {
        let t = s.text.trim();
        if t.is_empty() {
            continue;
        }
        doc = add_body_paragraph(doc, t, false);
        doc = doc.add_paragraph(Paragraph::new());
    }
    doc
}

/// 大模型润色后的段落列表；`spaced` 为 true 时段后插空行（干净稿版式）。
pub(crate) fn append_polished_paragraph_list(doc: Docx, paragraphs: &[String], spaced: bool) -> Docx {
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
        doc = add_body_paragraph(doc, &chunk, false);
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

/// 讲稿：按语段各占一个 Word 自然段（无时间码）；过长时截断并提示。
fn append_lecture_segments(doc: Docx, segments: &[SegmentDto]) -> Docx {
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
        doc = add_body_paragraph(doc, &chunk, false);
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

fn append_revision_appendix(doc: Docx, lines: &[String]) -> Docx {
    if lines.is_empty() {
        return doc;
    }
    let mut doc = doc;
    doc = doc.add_paragraph(Paragraph::new());
    doc = doc.add_paragraph(
        Paragraph::new().add_run(
            Run::new()
                .bold()
                .size(28)
                .add_text("附录：修订摘要"),
        ),
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

/// `export_mode`: `verbatim` | `lecture` | `clean`.
#[tauri::command]
pub async fn export_docx(
    default_filename: String,
    title: String,
    export_mode: String,
    segments: Vec<SegmentDto>,
    export_meta_line: Option<String>,
    appendix_lines: Option<Vec<String>>,
    polished_paragraphs: Option<Vec<String>>,
    polish_before_joined: Option<String>,
    polish_corrected_lines: Option<Vec<String>>,
    polish_track_changes: Option<bool>,
) -> Result<Option<String>, String> {
    let mode = normalize_export_mode(&export_mode);
    let meta = export_meta_line
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let appendix = appendix_lines.unwrap_or_default();
    let polished = polished_paragraphs
        .as_deref()
        .filter(|p| !p.is_empty());
    let before_joined = polish_before_joined
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let corrected_lines = polish_corrected_lines
        .as_deref()
        .filter(|p| !p.is_empty());
    let track = polish_track_changes.unwrap_or(false);
    let bytes = build_docx_bytes(
        &title,
        mode,
        &segments,
        meta,
        &appendix,
        polished,
        before_joined,
        corrected_lines,
        track,
    )?;
    let default_filename = default_filename;
    tauri::async_runtime::spawn_blocking(move || {
        let picked = rfd::FileDialog::new()
            .set_file_name(&default_filename)
            .save_file();
        let Some(path) = picked else {
            return Ok(None);
        };
        fs::write(&path, bytes).map_err(|e| format!("写入 DOCX 失败: {e}"))?;
        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("导出任务失败: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(text: &str, low: bool) -> SegmentDto {
        SegmentDto {
            uid: None,
            idx: 0,
            start_sec: 1.5,
            end_sec: 3.25,
            text: text.to_string(),
            confidence: None,
            low_confidence: low,
            detail: None,
            kind: None,
        }
    }

    #[test]
    fn normalize_export_mode_maps_clean_and_fallback() {
        assert_eq!(normalize_export_mode("clean"), "clean");
        assert_eq!(normalize_export_mode("lecture"), "lecture");
        assert_eq!(normalize_export_mode("verbatim"), "verbatim");
        assert_eq!(normalize_export_mode("other"), "verbatim");
    }

    #[test]
    fn format_hms_zero_pads() {
        assert_eq!(format_hms(3661.0), "01:01:01");
    }

    #[test]
    fn format_hms_non_finite_is_safe() {
        assert_eq!(format_hms(f64::NAN), "00:00:00");
        assert_eq!(format_hms(f64::INFINITY), "00:00:00");
    }

    #[test]
    fn sanitize_docx_text_strips_illegal_xml_chars() {
        let s = sanitize_docx_text("a\u{0000}b&c");
        assert_eq!(s, "ab&c");
    }

    #[test]
    fn sanitize_docx_text_does_not_pre_escape_entities() {
        let s = sanitize_docx_text("Tom & Jerry <3");
        assert_eq!(s, "Tom & Jerry <3");
    }

    #[test]
    fn build_docx_bytes_produces_zip_container() {
        let bytes = build_docx_bytes(
            "测试",
            "clean",
            &[seg("你好。", false)],
            Some("导出：测试"),
            &["修订行".to_string()],
            None,
            None,
            None,
            false,
        )
        .unwrap();
        assert!(bytes.len() > 200);
        assert_eq!(&bytes[0..2], b"PK");
    }

    #[test]
    fn lecture_mode_builds_per_segment() {
        let bytes = build_docx_bytes(
            "讲稿",
            "lecture",
            &[seg("第一段。", false), seg("第二段。", false)],
            None,
            &[],
            None,
            None,
            None,
            false,
        )
        .unwrap();
        assert!(bytes.len() > 200);
    }

    #[test]
    fn polished_paragraph_list_for_lecture_and_clean() {
        let bytes = build_docx_bytes(
            "讲稿",
            "lecture",
            &[],
            None,
            &[],
            Some(&["语义段一。".to_string(), "语义段二。".to_string()]),
            None,
            None,
            false,
        )
        .unwrap();
        assert!(bytes.len() > 200);
        let clean = build_docx_bytes(
            "干净",
            "clean",
            &[],
            None,
            &[],
            Some(&["A".to_string()]),
            None,
            None,
            false,
        )
        .unwrap();
        assert!(clean.len() > 200);
    }

    #[test]
    fn polish_track_changes_emits_ins_and_del() {
        use std::io::Cursor;
        use std::io::Read;
        use zip::read::ZipArchive;

        let bytes = build_docx_bytes(
            "润色",
            "lecture",
            &[seg("旧一。", false), seg("旧二。", false)],
            None,
            &[],
            Some(&["旧一。改\n\n旧二。改".to_string()]),
            Some("旧一。\n旧二。"),
            Some(&["旧一。改".to_string(), "旧二。改".to_string()]),
            true,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("w:ins") || doc_xml.contains("w:del"));
        assert!(doc_xml.contains(crate::export_docx_polish_track::POLISH_TRACK_AUTHOR));
    }

    #[test]
    fn polish_track_inline_diff_on_typo_fix() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let bytes = build_docx_bytes(
            "润色",
            "lecture",
            &[seg("你好世界", false)],
            None,
            &[],
            Some(&["你好，世界。".to_string()]),
            Some("你好世界"),
            Some(&["你好，世界。".to_string()]),
            true,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("w:ins") || doc_xml.contains("w:del"));
        assert!(doc_xml.contains("你好"));
    }
}

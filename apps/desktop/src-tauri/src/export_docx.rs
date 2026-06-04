//! EXP-WORD: delivery DOCX export — 逐字稿 / 讲稿 / 干净稿 + optional revision appendix.

use std::fs;

#[path = "export_docx_body.rs"]
mod export_docx_body;
#[path = "export_docx_build.rs"]
mod export_docx_build;

pub(crate) use export_docx_body::{
    add_body_paragraph, append_polished_paragraph_list, sanitize_docx_text, MAX_LECTURE_BODY_CHARS,
};
pub(crate) use export_docx_build::build_docx_bytes;

use export_docx_body::normalize_export_mode;
use crate::project::SegmentDto;

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
    use super::export_docx_body::{format_hms, normalize_export_mode, sanitize_docx_text};
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

    /// R9 strict: export clean DOCX from live app DB (`RUSHI_APP_DB`, optional `RUSHI_STRICT_DOCX_OUT`).
    #[test]
    fn r9_strict_export_docx_from_app_db() {
        use rusqlite::Connection;
        use std::path::Path;

        let db_path = match std::env::var("RUSHI_APP_DB") {
            Ok(p) if Path::new(&p).is_file() => p,
            _ => return,
        };
        let out = std::env::var("RUSHI_STRICT_DOCX_OUT")
            .unwrap_or_else(|_| "/tmp/r9-strict-clean.docx".to_string());

        let conn = Connection::open(&db_path).expect("open app db");
        let file_id: String = conn
            .query_row(
                "SELECT file_id FROM segments GROUP BY file_id ORDER BY COUNT(*) DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .expect("file with segments");

        let mut stmt = conn
            .prepare(
                "SELECT uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail, kind \
                 FROM segments WHERE file_id = ?1 ORDER BY idx ASC",
            )
            .expect("prepare segments");
        let rows = stmt
            .query_map([&file_id], |r| {
                let uid: String = r.get(0)?;
                Ok(SegmentDto {
                    uid: if uid.trim().is_empty() {
                        None
                    } else {
                        Some(uid)
                    },
                    idx: r.get(1)?,
                    start_sec: r.get(2)?,
                    end_sec: r.get(3)?,
                    text: r.get(4)?,
                    confidence: r.get(5)?,
                    low_confidence: r.get::<_, i64>(6)? != 0,
                    detail: r.get::<_, Option<String>>(7)?,
                    kind: r.get(8)?,
                })
            })
            .expect("query segments");
        let mut segments = Vec::new();
        for row in rows {
            segments.push(row.expect("segment row"));
        }
        assert!(!segments.is_empty(), "no segments for export");

        let title: String = conn
            .query_row(
                "SELECT p.name FROM files f JOIN projects p ON p.id = f.project_id WHERE f.id = ?1",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "R9 strict export".to_string());

        let bytes = build_docx_bytes(&title, "clean", &segments, None, &[], None, None, None, false)
            .expect("build docx");
        std::fs::write(&out, &bytes).expect("write docx");
        eprintln!("r9_strict_export: file_id={file_id} segments={} out={out}", segments.len());
    }
}

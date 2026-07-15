//! EXP-WORD: delivery DOCX export — 逐字稿 / 讲稿 / 干净稿 + optional revision appendix.

#[path = "export_docx_body.rs"]
mod export_docx_body;
#[path = "export_docx_build.rs"]
mod export_docx_build;

pub(crate) use export_docx_body::{
    add_body_paragraph, append_delivery_block_separator, append_delivery_block_time_end,
    append_delivery_block_time_start, append_polished_paragraph_list, sanitize_docx_text,
    DocxDeliveryTimeBlock, MAX_LECTURE_BODY_CHARS,
};
pub(crate) use export_docx_build::{build_docx_to_path, DocxExportLayout};

use serde::Deserialize;

use crate::project::SegmentDto;
use export_docx_body::normalize_export_mode;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DocxDeliveryTimeBlockDto {
    start_sec: f64,
    end_sec: f64,
    unit_count: usize,
}

fn map_delivery_time_blocks(dtos: Option<Vec<DocxDeliveryTimeBlockDto>>) -> Vec<export_docx_body::DocxDeliveryTimeBlock> {
    dtos.unwrap_or_default()
        .into_iter()
        .filter(|b| b.unit_count > 0 && b.start_sec.is_finite() && b.end_sec.is_finite())
        .map(|b| export_docx_body::DocxDeliveryTimeBlock {
            start_sec: b.start_sec,
            end_sec: b.end_sec,
            unit_count: b.unit_count,
        })
        .collect()
}

/// `export_mode`: `verbatim` | `lecture` | `clean`.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
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
    delivery_time_blocks: Option<Vec<DocxDeliveryTimeBlockDto>>,
    recording_file_name: Option<String>,
    footer_transcriber_name: Option<String>,
    footer_transcribed_at: Option<String>,
) -> Result<Option<String>, String> {
    let mode = normalize_export_mode(&export_mode);
    let appendix = appendix_lines.unwrap_or_default();
    let track = polish_track_changes.unwrap_or(false);
    let meta_owned = export_meta_line.filter(|s| !s.trim().is_empty());
    let polished_owned = polished_paragraphs.filter(|p| !p.is_empty());
    let before_owned = polish_before_joined.filter(|s| !s.trim().is_empty());
    let corrected_owned = polish_corrected_lines.filter(|p| !p.is_empty());
    let layout = DocxExportLayout {
        delivery_time_blocks: map_delivery_time_blocks(delivery_time_blocks),
        recording_file_name,
        footer_transcriber_name,
        footer_transcribed_at,
    };
    let picked = tauri::async_runtime::spawn_blocking({
        let default_filename = default_filename.clone();
        move || {
            rfd::FileDialog::new()
                .set_file_name(&default_filename)
                .save_file()
        }
    })
    .await
    .map_err(|e| format!("导出任务失败: {e}"))?;
    let Some(path) = picked else {
        return Ok(None);
    };
    tauri::async_runtime::spawn_blocking(move || {
        build_docx_to_path(
            &path,
            &title,
            mode,
            &segments,
            meta_owned.as_deref(),
            &appendix,
            polished_owned.as_deref(),
            before_owned.as_deref(),
            corrected_owned.as_deref(),
            track,
            &layout,
        )?;
        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("导出任务失败: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::export_docx_body::{format_hms, normalize_export_mode, sanitize_docx_text};
    use super::export_docx_build::{build_docx_bytes, DocxExportLayout};
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
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
            frozen: false,
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

    fn default_layout() -> DocxExportLayout {
        DocxExportLayout::default()
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
            &default_layout(),
        )
        .unwrap();
        assert!(bytes.len() > 200);
        assert_eq!(&bytes[0..2], b"PK");
    }

    #[test]
    fn build_docx_bytes_renders_multiline_project_metadata() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let meta = "导出：口述史 · 2026-06-08\n讲述人：张三\n地点：北京";
        let bytes = build_docx_bytes(
            "口述史",
            "clean",
            &[seg("正文。", false)],
            Some(meta),
            &[],
            None,
            None,
            None,
            false,
            &default_layout(),
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("讲述人：张三"));
        assert!(doc_xml.contains("地点：北京"));
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
            &default_layout(),
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
            &default_layout(),
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
            &default_layout(),
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
            Some(&format!(
                "旧一。{}旧二。",
                crate::postprocess_cmd::EXPORT_POLISH_LINE_SEPARATOR
            )),
            Some(&["旧一。改".to_string(), "旧二。改".to_string()]),
            true,
            &default_layout(),
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
            &default_layout(),
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

    #[test]
    fn lecture_export_includes_time_span_and_footer() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let layout = DocxExportLayout {
            delivery_time_blocks: vec![export_docx_body::DocxDeliveryTimeBlock {
                start_sec: 1.5,
                end_sec: 3.25,
                unit_count: 1,
            }],
            recording_file_name: Some("interview.wav".to_string()),
            footer_transcriber_name: Some("李四".to_string()),
            footer_transcribed_at: Some("2026-07-15".to_string()),
            ..DocxExportLayout::default()
        };
        let bytes = build_docx_bytes(
            "讲稿",
            "lecture",
            &[seg("第一段。", false)],
            None,
            &[],
            None,
            None,
            None,
            false,
            &layout,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("起始时间：00:00:01"));
        assert!(doc_xml.contains("结束时间：00:00:03"));
        assert!(doc_xml.contains("录音文件名称：interview.wav"));
        assert!(doc_xml.contains("转录人：李四"));
        assert!(doc_xml.contains("转录时间：2026-07-15"));
        assert!(doc_xml.contains(r#"w:val="right""#));
    }

    #[test]
    fn lecture_block_boundaries_when_discontinuous() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let layout = DocxExportLayout {
            delivery_time_blocks: vec![
                export_docx_body::DocxDeliveryTimeBlock {
                    start_sec: 0.0,
                    end_sec: 2.0,
                    unit_count: 1,
                },
                export_docx_body::DocxDeliveryTimeBlock {
                    start_sec: 10.0,
                    end_sec: 15.0,
                    unit_count: 1,
                },
            ],
            ..DocxExportLayout::default()
        };
        let bytes = build_docx_bytes(
            "讲稿",
            "lecture",
            &[
                seg("第一段。", false),
                SegmentDto {
                    start_sec: 10.0,
                    end_sec: 15.0,
                    text: "第二段。".to_string(),
                    ..seg("x", false)
                },
            ],
            None,
            &[],
            None,
            None,
            None,
            false,
            &layout,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("起始时间：00:00:00"));
        assert!(doc_xml.contains("结束时间：00:00:15"));
        assert!(!doc_xml.contains("[00:00:00 –"));
        assert!(doc_xml.contains("结束时间：00:00:02"));
        assert!(doc_xml.contains("起始时间：00:00:10"));
        assert!(doc_xml.contains(r#"w:val="right""#));
    }

    #[test]
    fn verbatim_differs_from_lecture_without_bracket_timestamps() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let segments = &[seg("正文句。", false)];
        let layout = DocxExportLayout {
            delivery_time_blocks: vec![export_docx_body::DocxDeliveryTimeBlock {
                start_sec: 1.5,
                end_sec: 3.25,
                unit_count: 1,
            }],
            ..DocxExportLayout::default()
        };
        let verbatim = build_docx_bytes(
            "逐字稿",
            "verbatim",
            segments,
            None,
            &[],
            None,
            None,
            None,
            false,
            &layout,
        )
        .unwrap();
        let lecture = build_docx_bytes(
            "讲稿",
            "lecture",
            segments,
            None,
            &[],
            None,
            None,
            None,
            false,
            &layout,
        )
        .unwrap();
        let read_xml = |bytes: Vec<u8>| {
            let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
            let mut doc_xml = String::new();
            archive
                .by_name("word/document.xml")
                .unwrap()
                .read_to_string(&mut doc_xml)
                .unwrap();
            doc_xml
        };
        let v = read_xml(verbatim);
        let l = read_xml(lecture);
        assert!(v.contains("[00:00:01 – 00:00:03]"));
        assert!(!l.contains("[00:00:01 – 00:00:03]"));
        assert!(l.contains("起始时间：00:00:01"));
        assert!(l.contains("结束时间：00:00:03"));
    }

    #[test]
    fn footer_omits_transcriber_when_layout_none() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let layout = DocxExportLayout {
            recording_file_name: Some("a.wav".to_string()),
            footer_transcriber_name: None,
            ..DocxExportLayout::default()
        };
        let bytes = build_docx_bytes(
            "逐字稿",
            "verbatim",
            &[seg("正文。", false)],
            None,
            &[],
            None,
            None,
            None,
            false,
            &layout,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("录音文件名称：a.wav"));
        assert!(!doc_xml.contains("转录人："));
    }

    #[test]
    fn polished_lecture_block_boundaries_when_discontinuous() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let layout = DocxExportLayout {
            delivery_time_blocks: vec![
                export_docx_body::DocxDeliveryTimeBlock {
                    start_sec: 0.0,
                    end_sec: 2.0,
                    unit_count: 1,
                },
                export_docx_body::DocxDeliveryTimeBlock {
                    start_sec: 10.0,
                    end_sec: 15.0,
                    unit_count: 1,
                },
            ],
            ..DocxExportLayout::default()
        };
        let bytes = build_docx_bytes(
            "讲稿",
            "lecture",
            &[],
            None,
            &[],
            Some(&["润色段一。".to_string(), "润色段二。".to_string()]),
            None,
            None,
            false,
            &layout,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("结束时间：00:00:02"));
        assert!(doc_xml.contains("起始时间：00:00:10"));
        assert!(!doc_xml.contains("冻结跳过"));
    }

    #[test]
    fn verbatim_truncates_when_body_exceeds_limit() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let huge = "字".repeat(MAX_LECTURE_BODY_CHARS + 100);
        let bytes = build_docx_bytes(
            "逐字稿",
            "verbatim",
            &[seg(&huge, false)],
            None,
            &[],
            None,
            None,
            None,
            false,
            &default_layout(),
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("已截断"));
    }

    #[test]
    fn clean_without_blocks_truncates_when_body_exceeds_limit() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let huge = "字".repeat(MAX_LECTURE_BODY_CHARS + 100);
        let bytes = build_docx_bytes(
            "干净稿",
            "clean",
            &[seg(&huge, false)],
            None,
            &[],
            None,
            None,
            None,
            false,
            &default_layout(),
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("已截断"));
    }

    #[test]
    fn clean_with_blocks_truncates_when_body_exceeds_limit() {
        use std::io::{Cursor, Read};
        use zip::read::ZipArchive;

        let huge = "字".repeat(MAX_LECTURE_BODY_CHARS + 100);
        let layout = DocxExportLayout {
            delivery_time_blocks: vec![export_docx_body::DocxDeliveryTimeBlock {
                start_sec: 0.0,
                end_sec: 10.0,
                unit_count: 1,
            }],
            ..DocxExportLayout::default()
        };
        let bytes = build_docx_bytes(
            "干净稿",
            "clean",
            &[seg(&huge, false)],
            None,
            &[],
            None,
            None,
            None,
            false,
            &layout,
        )
        .unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut doc_xml = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut doc_xml)
            .unwrap();
        assert!(doc_xml.contains("已截断"));
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
        crate::db::configure_sqlite_connection_readonly(&conn).expect("configure sqlite");
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
                    text_stage: "auto_transcribe".to_string(),
                    finalize_via: None,
                    annotation: None,
                    frozen: false,
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

        let bytes = build_docx_bytes(
            &title,
            "clean",
            &segments,
            None,
            &[],
            None,
            None,
            None,
            false,
            &default_layout(),
        )
        .expect("build docx");
        std::fs::write(&out, &bytes).expect("write docx");
        eprintln!(
            "r9_strict_export: file_id={file_id} segments={} out={out}",
            segments.len()
        );
    }
}

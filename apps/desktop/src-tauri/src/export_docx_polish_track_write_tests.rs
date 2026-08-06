use std::io::{Cursor, Read};

use quick_xml::events::Event;
use quick_xml::name::QName;
use quick_xml::Reader;
use zip::read::ZipArchive;

use super::super::diff::{pieces_have_markup, DiffPiece};
use super::*;

fn build_track_docx(
    before_lines: &[String],
    corrected_lines: &[String],
    paragraphs: &[String],
) -> Vec<u8> {
    let separator = crate::postprocess_cmd::EXPORT_POLISH_LINE_SEPARATOR.to_string();
    let before_joined = before_lines.join(&separator);
    let mut comments = DocxAnnotationComments::default();
    let doc = append_polished_with_track_changes(
        Docx::new(),
        &mut comments,
        &before_joined,
        corrected_lines,
        paragraphs,
        None,
        false,
        None,
        POLISH_TRACK_AUTHOR,
    );
    let mut bytes = Vec::new();
    doc.build()
        .pack(&mut Cursor::new(&mut bytes))
        .expect("DOCX should build");
    bytes
}

fn document_xml(bytes: &[u8]) -> String {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).expect("DOCX should open");
    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .expect("document.xml should exist")
        .read_to_string(&mut xml)
        .expect("document.xml should be UTF-8");
    xml
}

/// Word「接受全部修订」后的可见正文：计入 `w:t`，跳过 `w:del` 祖先下的文本。
fn accepted_document_text(xml: &str) -> String {
    let mut reader = Reader::from_str(xml);
    let mut out = String::new();
    let mut in_text = false;
    let mut del_depth = 0usize;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf).expect("XML should parse") {
            Event::Eof => break,
            Event::Start(e) => {
                let name = e.name();
                if name == QName(b"w:del") {
                    del_depth = del_depth.saturating_add(1);
                } else if name == QName(b"w:t") && del_depth == 0 {
                    in_text = true;
                }
            }
            Event::Text(e) if in_text && del_depth == 0 => {
                out.push_str(&e.unescape().expect("text should unescape"));
            }
            Event::End(e) => {
                let name = e.name();
                if name == QName(b"w:t") {
                    in_text = false;
                } else if name == QName(b"w:del") {
                    del_depth = del_depth.saturating_sub(1);
                }
            }
            _ => {}
        }
        buf.clear();
    }
    out
}

fn deleted_document_text(xml: &str) -> String {
    let mut reader = Reader::from_str(xml);
    let mut out = String::new();
    let mut del_depth = 0usize;
    let mut in_del_text = false;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf).expect("XML should parse") {
            Event::Eof => break,
            Event::Start(e) => {
                let name = e.name();
                if name == QName(b"w:del") {
                    del_depth = del_depth.saturating_add(1);
                } else if del_depth > 0 && (name == QName(b"w:t") || name == QName(b"w:delText")) {
                    in_del_text = true;
                }
            }
            Event::Text(e) if in_del_text => {
                out.push_str(&e.unescape().expect("text should unescape"));
            }
            Event::End(e) => {
                let name = e.name();
                if name == QName(b"w:t") || name == QName(b"w:delText") {
                    in_del_text = false;
                } else if name == QName(b"w:del") {
                    del_depth = del_depth.saturating_sub(1);
                }
            }
            _ => {}
        }
        buf.clear();
    }
    out
}

#[test]
fn line_diff_maps_to_paragraph_bucket() {
    let before = vec!["你好世界".into()];
    let after = vec!["你好，世界。".into()];
    let paras = vec!["你好，世界。".into()];
    let buckets = accumulate_line_diffs_into_paragraphs(&before, &after, &paras);
    assert!(pieces_have_markup(&buckets[0]));
    assert!(buckets_preserve_corrected_lines(&buckets, &after));
}

#[test]
fn unchanged_lines_are_kept_around_sparse_punctuation_change() {
    let before = vec!["第一句".into(), "第二句".into(), "第三句".into()];
    let after = vec!["第一句".into(), "第二，句。".into(), "第三句".into()];
    let paragraphs = vec![after.concat()];
    let buckets = accumulate_line_diffs_into_paragraphs(&before, &after, &paragraphs);

    assert!(pieces_have_markup(&buckets[0]));
    assert_eq!(final_text_from_diff_pieces(&buckets[0]), after.concat());
    assert!(buckets_preserve_corrected_lines(&buckets, &after));
}

#[test]
fn accepted_docx_view_keeps_unchanged_lines_in_edited_paragraph() {
    let before = vec!["第一句".into(), "第二句".into(), "第三句".into()];
    let after = vec!["第一句".into(), "第二，句。".into(), "第三句".into()];
    let paragraphs = vec![after.concat()];
    let bytes = build_track_docx(&before, &after, &paragraphs);
    let xml = document_xml(&bytes);

    assert!(xml.contains("w:ins") || xml.contains("w:del"));
    assert_eq!(accepted_document_text(&xml), after.concat());
}

#[test]
fn accepted_docx_view_excludes_deleted_typo_text() {
    let before = vec!["开场先说禅堂纪律辛库。".into()];
    let after = vec!["开场先说禅堂纪律辛苦。".into()];
    let paragraphs = vec![after.concat()];
    let bytes = build_track_docx(&before, &after, &paragraphs);
    let xml = document_xml(&bytes);

    assert!(xml.contains("w:del"));
    assert!(xml.contains("w:ins"));
    assert_eq!(accepted_document_text(&xml), after.concat());
    let deleted = deleted_document_text(&xml);
    assert!(deleted.contains('库'), "deleted track should carry removed typo: {deleted}");
    assert!(
        !accepted_document_text(&xml).contains('库'),
        "accepted body must not keep deleted typo"
    );
}

#[test]
fn track_assembly_degrades_when_bucket_invariant_fails() {
    // 不合格大段删除会被压成 Same(before)，接受视图含已删字，与 corrected 不一致 → 降级无轨。
    let before = vec!["开场先说纪律。我们把禅堂看得比殿堂还要重。虽然条件简陋，但对学修很投入。".into()];
    let after = vec!["开场先说纪律。虽然条件简陋，但对学修很投入。".into()];
    let paragraphs = vec![after.concat()];
    assert!(
        !buckets_preserve_corrected_lines(
            &accumulate_line_diffs_into_paragraphs(&before, &after, &paragraphs),
            &after
        ),
        "fixture must violate preserve invariant"
    );
    let bytes = build_track_docx(&before, &after, &paragraphs);
    let xml = document_xml(&bytes);

    assert!(
        !xml.contains("w:ins") && !xml.contains("w:del"),
        "invariant failure must degrade to plain body without track markup"
    );
    assert_eq!(accepted_document_text(&xml), after.concat());
}

#[test]
fn accepted_docx_view_preserves_3541_sparse_edited_lines() {
    let before: Vec<String> = (0..3541)
        .map(|index| format!("语段{index:04}正文"))
        .collect();
    let after: Vec<String> = before
        .iter()
        .enumerate()
        .map(|(index, line)| {
            if index % 17 == 0 {
                format!("{line}。")
            } else {
                line.clone()
            }
        })
        .collect();
    let paragraphs: Vec<String> = after.chunks(20).map(|lines| lines.concat()).collect();
    let bytes = build_track_docx(&before, &after, &paragraphs);
    let xml = document_xml(&bytes);

    assert!(xml.contains("w:ins") || xml.contains("w:del"));
    assert_eq!(accepted_document_text(&xml), after.concat());
}

#[test]
fn bucket_invariant_rejects_missing_final_text() {
    let buckets = vec![vec![DiffPiece::Same("甲".into())]];
    let corrected = vec!["甲".into(), "乙".into()];
    assert!(!buckets_preserve_corrected_lines(&buckets, &corrected));
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

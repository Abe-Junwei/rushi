//! P3: minimal DOCX export (fixed layout) — 逐字稿 / 讲稿 两种段落结构。

use std::fs;
use std::io::Cursor;

use docx_rs::*;

use crate::p1::SegmentDto;

fn build_docx_bytes(title: &str, export_mode: &str, segments: &[SegmentDto]) -> Result<Vec<u8>, String> {
    let mut doc = Docx::new();
    doc = doc.add_paragraph(
        Paragraph::new().add_run(Run::new().bold().size(40).add_text(sanitize_title(title))),
    );
    doc = doc.add_paragraph(Paragraph::new());

    match export_mode {
        "lecture" => {
            let mut body = String::new();
            for s in segments {
                let t = s.text.trim();
                if t.is_empty() {
                    continue;
                }
                if !body.is_empty() {
                    body.push_str("\n\n");
                }
                body.push_str(t);
            }
            if body.is_empty() {
                body.push_str("（无正文）");
            }
            doc = doc.add_paragraph(Paragraph::new().add_run(Run::new().size(24).add_text(body)));
        }
        _ => {
            for s in segments {
                let meta = format!("[{:.2} – {:.2}]", s.start_sec, s.end_sec);
                doc = doc.add_paragraph(
                    Paragraph::new().add_run(Run::new().size(20).color("666666").add_text(meta)),
                );
                let mut run = Run::new().size(24).add_text(s.text.clone());
                if s.low_confidence {
                    run = run.highlight("yellow");
                }
                doc = doc.add_paragraph(Paragraph::new().add_run(run));
                doc = doc.add_paragraph(Paragraph::new());
            }
        }
    }

    let mut buf = Vec::new();
    let mut cur = Cursor::new(&mut buf);
    doc.build()
        .pack(&mut cur)
        .map_err(|e| format!("生成 DOCX 失败: {e}"))?;
    Ok(buf)
}

fn sanitize_title(title: &str) -> String {
    let t = title.trim();
    if t.is_empty() {
        "未命名".to_string()
    } else {
        t.chars().take(200).collect()
    }
}

/// `export_mode`: `verbatim`（逐字稿：每段带时间轴）或 `lecture`（讲稿：连续正文）。
#[tauri::command]
pub fn p3_export_docx(
    default_filename: String,
    title: String,
    export_mode: String,
    segments: Vec<SegmentDto>,
) -> Result<Option<String>, String> {
    let mode = export_mode.trim();
    let mode = if mode == "lecture" { "lecture" } else { "verbatim" };
    let bytes = build_docx_bytes(&title, mode, &segments)?;
    let picked = rfd::FileDialog::new()
        .set_file_name(&default_filename)
        .save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    fs::write(&path, bytes).map_err(|e| format!("写入 DOCX 失败: {e}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

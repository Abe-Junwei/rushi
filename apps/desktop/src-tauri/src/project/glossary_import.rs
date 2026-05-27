//! Import glossary terms from Excel / CSV / TSV files.

use super::glossary_bulk_parse::parse_glossary_bulk_text;
use super::glossary_insert::GlossaryInsertRow;
use super::glossary_structured_import::{headers_are_structured, rows_from_structured_text};
use calamine::{open_workbook_auto, Data, Reader};
use std::collections::HashSet;
use std::path::Path;

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::String(s) => s.trim().to_string(),
        Data::Int(n) => n.to_string(),
        Data::Float(f) => f.to_string(),
        Data::Bool(b) => b.to_string(),
        _ => String::new(),
    }
}

fn cell_to_term(cell: &Data) -> Option<String> {
    match cell {
        Data::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
        Data::Int(_) | Data::Float(_) | Data::Bool(_) | Data::DateTime(_) | Data::Empty | Data::Error(_) => {
            None
        }
        _ => None,
    }
}

fn rows_from_excel_workbook(path: &Path) -> Result<Vec<GlossaryInsertRow>, String> {
    let mut workbook =
        open_workbook_auto(path).map_err(|e| format!("无法打开表格文件：{e}"))?;
    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "表格中没有工作表".to_string())?;
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("无法读取工作表「{sheet_name}」：{e}"))?;

    let mut rows_iter = range.rows();
    let Some(header_row) = rows_iter.next() else {
        return Ok(Vec::new());
    };
    let headers: Vec<String> = header_row.iter().map(cell_to_string).collect();
    if headers_are_structured(&headers) {
        let term_idx = headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case("term"))
            .ok_or_else(|| "表头缺少 term 列".to_string())?;
        let aliases_idx = headers.iter().position(|h| h.eq_ignore_ascii_case("aliases"));
        let domain_idx = headers.iter().position(|h| h.eq_ignore_ascii_case("domain"));
        let note_idx = headers.iter().position(|h| h.eq_ignore_ascii_case("note"));
        let hotword_idx = headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case("hotword_enabled"));
        let mut out = Vec::new();
        for row in rows_iter {
            let fields: Vec<String> = row.iter().map(cell_to_string).collect();
            let term = fields.get(term_idx).map(|s| s.trim()).unwrap_or("");
            if term.is_empty() {
                continue;
            }
            out.push(GlossaryInsertRow {
                term: term.to_string(),
                aliases: aliases_idx
                    .and_then(|i| fields.get(i))
                    .map(|s| s.trim().to_string())
                    .unwrap_or_default(),
                domain: domain_idx
                    .and_then(|i| fields.get(i))
                    .map(|s| s.trim().to_string())
                    .unwrap_or_default(),
                note: note_idx
                    .and_then(|i| fields.get(i))
                    .map(|s| s.trim().to_string())
                    .unwrap_or_default(),
                hotword_enabled: hotword_idx
                    .and_then(|i| fields.get(i))
                    .map(|s| super::glossary_insert::parse_hotword_enabled_cell(s))
                    .unwrap_or(true),
            });
        }
        return Ok(out);
    }

    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for row in std::iter::once(header_row).chain(rows_iter) {
        for cell in row {
            if let Some(t) = cell_to_term(cell) {
                let key = t.to_lowercase();
                if seen.insert(key) {
                    out.push(GlossaryInsertRow::term_only(t));
                }
            }
        }
    }
    Ok(out)
}

pub fn rows_from_glossary_file(path: &Path) -> Result<Vec<GlossaryInsertRow>, String> {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "xlsx" | "xls" | "xlsm" | "ods" => rows_from_excel_workbook(path),
        "csv" | "tsv" | "txt" => {
            let content = std::fs::read_to_string(path).map_err(|e| format!("无法读取文件：{e}"))?;
            if let Some(rows) = rows_from_structured_text(&content) {
                return Ok(rows);
            }
            Ok(parse_glossary_bulk_text(&content)
                .into_iter()
                .map(GlossaryInsertRow::term_only)
                .collect())
        }
        other => Err(format!(
            "不支持的文件类型 .{other}，请使用 .xlsx、.xls、.csv 或 .tsv"
        )),
    }
}

/// Legacy: flat term strings only (tests / callers).
pub fn terms_from_glossary_file(path: &Path) -> Result<Vec<String>, String> {
    Ok(rows_from_glossary_file(path)?
        .into_iter()
        .map(|r| r.term)
        .collect())
}

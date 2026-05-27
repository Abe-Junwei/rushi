//! Parse structured glossary CSV/TSV exports (header row required).

use super::glossary_insert::{parse_hotword_enabled_cell, GlossaryInsertRow};

fn split_csv_line(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' if in_quotes => {
                if chars.peek() == Some(&'"') {
                    cur.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            }
            '"' => in_quotes = true,
            ',' if !in_quotes => {
                out.push(cur.clone());
                cur.clear();
            }
            _ => cur.push(c),
        }
    }
    out.push(cur);
    out
}

fn header_index(headers: &[String], name: &str) -> Option<usize> {
    headers
        .iter()
        .position(|h| h.trim().eq_ignore_ascii_case(name))
}

fn row_from_fields(headers: &[String], fields: &[String]) -> Option<GlossaryInsertRow> {
    let term_idx = header_index(headers, "term")?;
    let term = fields.get(term_idx)?.trim().to_string();
    if term.is_empty() {
        return None;
    }
    let aliases = header_index(headers, "aliases")
        .and_then(|i| fields.get(i))
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    let domain = header_index(headers, "domain")
        .and_then(|i| fields.get(i))
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    let note = header_index(headers, "note")
        .and_then(|i| fields.get(i))
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    let hotword_enabled = header_index(headers, "hotword_enabled")
        .and_then(|i| fields.get(i))
        .map(|s| parse_hotword_enabled_cell(s))
        .unwrap_or(true);
    Some(GlossaryInsertRow {
        term,
        aliases,
        domain,
        note,
        hotword_enabled,
    })
}

pub fn is_structured_glossary_header(line: &str) -> bool {
    let headers: Vec<String> = if line.contains('\t') && !line.contains(',') {
        line.split('\t').map(|s| s.trim().to_string()).collect()
    } else {
        split_csv_line(line)
    };
    headers_are_structured(&headers)
}

pub fn headers_are_structured(headers: &[String]) -> bool {
    header_index(headers, "term").is_some()
}

pub fn rows_from_structured_text(content: &str) -> Option<Vec<GlossaryInsertRow>> {
    let mut lines = content.lines().filter(|l| !l.trim().is_empty());
    let header_line = lines.next()?;
    if !is_structured_glossary_header(header_line) {
        return None;
    }
    let delimiter_is_tab = header_line.contains('\t') && !header_line.contains(',');
    let headers: Vec<String> = if delimiter_is_tab {
        header_line.split('\t').map(|s| s.trim().to_string()).collect()
    } else {
        split_csv_line(header_line)
    };
    let mut out = Vec::new();
    for line in lines {
        let fields: Vec<String> = if delimiter_is_tab {
            line.split('\t').map(|s| s.to_string()).collect()
        } else {
            split_csv_line(line)
        };
        if let Some(row) = row_from_fields(&headers, &fields) {
            out.push(row);
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_exported_csv_shape() {
        let csv = "term,aliases,domain,note,hotword_enabled,created_at_ms,updated_at_ms\n三乘,主任,佛学,,1,1,2\n学记,,,,0,3,4";
        let rows = rows_from_structured_text(csv).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].term, "三乘");
        assert!(rows[0].hotword_enabled);
        assert!(!rows[1].hotword_enabled);
    }
}

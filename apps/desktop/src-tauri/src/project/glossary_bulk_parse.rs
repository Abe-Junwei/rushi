//! Parse bulk glossary terms from spreadsheet clipboard text or CSV/TSV files.

use std::collections::HashSet;

pub fn normalize_spreadsheet_text(raw: &str) -> String {
    raw.trim_start_matches('\u{FEFF}')
        .replace('\r', "\n")
        .replace('\u{00A0}', " ")
}

fn normalize_glossary_cell(raw: &str) -> Option<String> {
    let mut t = raw.trim();
    if t.is_empty() {
        return None;
    }
    if (t.starts_with('"') && t.ends_with('"')) || (t.starts_with('\'') && t.ends_with('\'')) {
        t = &t[1..t.len() - 1];
        t = t.trim();
    }
    if t.is_empty() {
        return None;
    }
    Some(t.to_string())
}

fn contains_list_delimiter(s: &str) -> bool {
    s.contains(',') || s.contains('，') || s.contains(';') || s.contains('；') || s.contains('、')
}

fn split_list_delimiters(s: &str) -> impl Iterator<Item = &str> {
    s.split(|c: char| {
        matches!(
            c,
            ',' | '，' | ';' | '；' | '、' | '\t' | '\n'
        )
    })
}

fn push_unique(out: &mut Vec<String>, seen: &mut HashSet<String>, term: Option<String>) {
    let Some(t) = term else {
        return;
    };
    let key = t.to_lowercase();
    if seen.insert(key) {
        out.push(t);
    }
}

/// Flatten Excel clipboard / CSV / TSV into individual terms (first sheet semantics for files).
pub fn parse_glossary_bulk_text(raw: &str) -> Vec<String> {
    let normalized = normalize_spreadsheet_text(raw);
    if normalized.is_empty() {
        return Vec::new();
    }

    let has_tab = normalized.contains('\t');
    let has_newline = normalized.contains('\n');
    let mut seen = HashSet::new();
    let mut out = Vec::new();

    if !has_tab && !has_newline && contains_list_delimiter(&normalized) {
        for piece in split_list_delimiters(&normalized) {
            push_unique(&mut out, &mut seen, normalize_glossary_cell(piece));
        }
        return out;
    }

    for row in normalized.split('\n') {
        let row = row.trim();
        if row.is_empty() {
            continue;
        }
        if has_tab {
            for cell in row.split('\t') {
                push_unique(&mut out, &mut seen, normalize_glossary_cell(cell));
            }
        } else {
            push_unique(&mut out, &mut seen, normalize_glossary_cell(row));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_excel_tsv_grid() {
        let terms = parse_glossary_bulk_text("三乘\t主任\n今天\t有学");
        assert_eq!(terms, vec!["三乘", "主任", "今天", "有学"]);
    }

    #[test]
    fn parses_csv_single_line() {
        let terms = parse_glossary_bulk_text("《六祖坛经》，《学记》");
        assert_eq!(terms, vec!["《六祖坛经》", "《学记》"]);
    }

    #[test]
    fn strips_quoted_csv_cells() {
        let terms = parse_glossary_bulk_text("\"foo\"\t\"bar\"\n");
        assert_eq!(terms, vec!["foo", "bar"]);
    }
}

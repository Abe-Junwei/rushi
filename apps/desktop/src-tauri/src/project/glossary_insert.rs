//! Shared insert shape for glossary import / batch add.

#[derive(Debug, Clone)]
pub struct GlossaryInsertRow {
    pub term: String,
    pub aliases: String,
    pub domain: String,
    pub note: String,
    pub hotword_enabled: bool,
}

impl GlossaryInsertRow {
    pub fn term_only(term: String) -> Self {
        Self {
            term,
            aliases: String::new(),
            domain: String::new(),
            note: String::new(),
            hotword_enabled: true,
        }
    }
}

pub fn parse_hotword_enabled_cell(raw: &str) -> bool {
    let t = raw.trim().to_ascii_lowercase();
    if t.is_empty() {
        return true;
    }
    if matches!(t.as_str(), "0" | "false" | "no" | "n" | "off" | "否" | "移出") {
        return false;
    }
    if matches!(t.as_str(), "1" | "true" | "yes" | "y" | "on" | "是" | "纳入") {
        return true;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hotword_flag_cells() {
        assert!(parse_hotword_enabled_cell("1"));
        assert!(!parse_hotword_enabled_cell("0"));
        assert!(!parse_hotword_enabled_cell("false"));
        assert!(parse_hotword_enabled_cell(""));
    }
}

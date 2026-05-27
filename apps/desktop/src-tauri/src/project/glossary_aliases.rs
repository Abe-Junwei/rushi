//! Split stored alias strings into ASR hotword tokens.

const ALIAS_DELIMS: [char; 6] = [',', '，', '、', ';', '；', '\n'];

/// Parse comma/顿号/换行分隔的别名字符串为独立 token（去空白、去重顺序保留）。
pub fn split_glossary_alias_tokens(raw: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for piece in raw.split(|c: char| ALIAS_DELIMS.contains(&c)) {
        let t = piece.trim();
        if t.is_empty() {
            continue;
        }
        let key = t.to_lowercase();
        if seen.insert(key) {
            out.push(t.to_string());
        }
    }
    out
}

/// Primary term plus alias tokens for hotwords assembly (term first, then aliases).
pub fn hotword_tokens_for_entry(term: &str, aliases: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let primary = term.trim();
    if !primary.is_empty() {
        seen.insert(primary.to_lowercase());
        out.push(primary.to_string());
    }
    for alias in split_glossary_alias_tokens(aliases) {
        let key = alias.to_lowercase();
        if seen.insert(key) {
            out.push(alias);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_mixed_delimiters() {
        assert_eq!(
            split_glossary_alias_tokens("Foo，bar、 baz\nqux"),
            vec!["Foo", "bar", "baz", "qux"]
        );
    }

    #[test]
    fn hotword_tokens_dedupes_alias_matching_term() {
        assert_eq!(
            hotword_tokens_for_entry("三乘", "三乘, 主任"),
            vec!["三乘", "主任"]
        );
    }
}

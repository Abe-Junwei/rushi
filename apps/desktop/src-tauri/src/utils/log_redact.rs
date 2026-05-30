//! Redact secrets before writing diagnostic log lines.

const MAX_SNIPPET_CHARS: usize = 500;

fn replace_bearer_tokens(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let rest = &input[i..];
        if rest.len() >= 7 && rest[..7].eq_ignore_ascii_case("bearer ") {
            out.push_str("Bearer [REDACTED]");
            i += 7;
            while i < bytes.len() && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            while i < bytes.len() && !bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            continue;
        }
        if rest.len() >= 8 && rest[..8].eq_ignore_ascii_case("api_key=") {
            out.push_str("api_key=[REDACTED]");
            i += 8;
            while i < bytes.len() && bytes[i] != b'&' && !bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            continue;
        }
        if let Some(ch) = rest.chars().next() {
            out.push(ch);
            i += ch.len_utf8();
        } else {
            break;
        }
    }
    out
}

fn replace_json_secret_fields(input: &str) -> String {
    let mut out = input.to_string();
    for key in [
        "\"api_key\"",
        "\"apiKey\"",
        "\"secret\"",
        "\"secret_key\"",
        "\"access_token\"",
        "\"authorization\"",
    ] {
        if let Some(start) = out.find(key) {
            if let Some(colon) = out[start..].find(':') {
                let value_start = start + colon + 1;
                if let Some(rest) = out.get(value_start..) {
                    let trimmed = rest.trim_start();
                    if trimmed.starts_with('"') {
                        if let Some(end_quote) = trimmed[1..].find('"') {
                            let replace_end = value_start + (rest.len() - trimmed.len()) + 1 + end_quote + 1;
                            out.replace_range(value_start..replace_end, " \"[REDACTED]\"");
                        }
                    }
                }
            }
        }
    }
    out
}

fn replace_sk_like_tokens(input: &str) -> String {
    let mut out = String::new();
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if (ch == 's' || ch == 'S')
            && chars.peek().copied().map(|c| c == 'k' || c == 'K') == Some(true)
        {
            let mut token = String::from(ch);
            token.push(chars.next().unwrap());
            while let Some(&next) = chars.peek() {
                if next.is_ascii_alphanumeric() || next == '-' || next == '_' {
                    token.push(next);
                    chars.next();
                } else {
                    break;
                }
            }
            if token.len() >= 8 {
                out.push_str("[REDACTED]");
            } else {
                out.push_str(&token);
            }
        } else {
            out.push(ch);
        }
    }
    out
}

/// Best-effort redaction for log lines that may echo HTTP bodies or auth headers.
pub fn redact_secrets_for_log(input: &str) -> String {
    let step1 = replace_bearer_tokens(input);
    let step2 = replace_json_secret_fields(&step1);
    replace_sk_like_tokens(&step2)
}

/// Truncate and redact an HTTP response body before logging.
pub fn redact_http_body_snippet(body: &str) -> String {
    let trimmed: String = body.chars().take(MAX_SNIPPET_CHARS).collect();
    redact_secrets_for_log(&trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_bearer_tokens() {
        let out = redact_secrets_for_log("Authorization: Bearer sk-test-secret-token");
        assert!(!out.contains("sk-test-secret-token"));
        assert!(out.contains("[REDACTED]"));
    }

    #[test]
    fn redacts_json_api_key_field() {
        let out = redact_http_body_snippet(r#"{"error":{"message":"bad","api_key":"sk-live"}}"#);
        assert!(!out.contains("sk-live"));
        assert!(out.contains("[REDACTED]"));
    }

    #[test]
    fn redacts_sk_prefixed_tokens() {
        let out = redact_secrets_for_log("upstream said sk-abcdef1234567890 invalid");
        assert!(!out.contains("sk-abcdef1234567890"));
    }
}

//! 讯飞 speedTranscription HMAC-SHA256 签名。

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

pub fn rfc1123_gmt_now() -> String {
    Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string()
}

pub fn digest_header(body: &[u8]) -> String {
    let hash = Sha256::digest(body);
    format!("SHA-256={}", B64.encode(hash))
}

pub fn authorization_header(
    host: &str,
    method: &str,
    path: &str,
    body: &[u8],
    api_key: &str,
    api_secret: &str,
    date: &str,
) -> String {
    let digest = digest_header(body);
    let request_line = format!("{method} {path} HTTP/1.1");
    let signature_origin = format!(
        "host: {host}\ndate: {date}\n{request_line}\ndigest: {digest}"
    );
    let mut mac =
        HmacSha256::new_from_slice(api_secret.as_bytes()).expect("HMAC key length");
    mac.update(signature_origin.as_bytes());
    let signature = B64.encode(mac.finalize().into_bytes());
    format!(
        r#"api_key="{api_key}", algorithm="hmac-sha256", headers="host date request-line digest", signature="{signature}""#
    )
}

pub fn signed_json_headers(
    host: &str,
    path: &str,
    body: &[u8],
    api_key: &str,
    api_secret: &str,
) -> Vec<(String, String)> {
    let date = rfc1123_gmt_now();
    let auth = authorization_header(host, "POST", path, body, api_key, api_secret, &date);
    let digest = digest_header(body);
    vec![
        ("host".to_string(), host.to_string()),
        ("date".to_string(), date),
        ("digest".to_string(), digest),
        ("authorization".to_string(), auth),
        ("content-type".to_string(), "application/json".to_string()),
    ]
}

pub fn signed_multipart_headers(
    host: &str,
    path: &str,
    body: &[u8],
    content_type: &str,
    api_key: &str,
    api_secret: &str,
) -> Vec<(String, String)> {
    let date = rfc1123_gmt_now();
    let auth = authorization_header(host, "POST", path, body, api_key, api_secret, &date);
    let digest = digest_header(body);
    vec![
        ("host".to_string(), host.to_string()),
        ("date".to_string(), date),
        ("digest".to_string(), digest),
        ("authorization".to_string(), auth),
        ("content-type".to_string(), content_type.to_string()),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digest_empty_body_matches_sha256_prefix() {
        let d = digest_header(b"");
        assert!(d.starts_with("SHA-256="));
        assert!(d.len() > 12);
    }

    #[test]
    fn authorization_includes_api_key_field() {
        let body = br#"{"hello":"world"}"#;
        let auth = authorization_header(
            "ost-api.xfyun.cn",
            "POST",
            "/v2/ost/pro_create",
            body,
            "test_api_key",
            "test_api_secret",
            "Wed, 05 Jan 2022 09:29:14 GMT",
        );
        assert!(auth.contains(r#"api_key="test_api_key""#));
        assert!(auth.contains("algorithm=\"hmac-sha256\""));
        assert!(auth.contains("signature="));
    }
}

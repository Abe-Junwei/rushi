//! Optional loopback token for rushi-asr mutating endpoints (`RUSHI_LOCAL_TOKEN`).

use reqwest::RequestBuilder;
use std::sync::{Mutex, OnceLock};
use uuid::Uuid;

pub const TOKEN_HEADER: &str = "x-rushi-local-token";

static MANAGED_TOKEN: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn managed_token_store() -> &'static Mutex<Option<String>> {
    MANAGED_TOKEN.get_or_init(|| Mutex::new(None))
}

/// Generate a sidecar-local token (desktop-managed bundled child only).
pub fn generate_local_token() -> String {
    format!("rushi-{}", Uuid::new_v4())
}

/// Set token for requests to our bundled sidecar; clear when child stops.
pub fn set_managed_local_token(token: Option<String>) {
    if let Ok(mut g) = managed_token_store().lock() {
        *g = token.filter(|t| !t.trim().is_empty());
    }
}

pub fn clear_managed_local_token() {
    set_managed_local_token(None);
}

/// Managed token from bundled spawn, else optional `RUSHI_LOCAL_TOKEN` env (dev parity).
pub fn resolve_local_token_for_request() -> Option<String> {
    if let Ok(g) = managed_token_store().lock() {
        if let Some(t) = g.as_ref().filter(|t| !t.trim().is_empty()) {
            return Some(t.clone());
        }
    }
    std::env::var("RUSHI_LOCAL_TOKEN")
        .ok()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
}

pub fn apply_local_token_header(req: RequestBuilder) -> RequestBuilder {
    match resolve_local_token_for_request() {
        Some(token) => req.header(TOKEN_HEADER, token),
        None => req,
    }
}

pub fn is_asr_loopback_url(raw: &str) -> bool {
    let Ok(url) = url::Url::parse(raw.trim()) else {
        return false;
    };
    let port = url.port().unwrap_or(80);
    if port != super::ASR_LOOPBACK_PORT {
        return false;
    }
    matches!(
        url.host_str().map(|h| h.to_ascii_lowercase()).as_deref(),
        Some("127.0.0.1" | "localhost" | "::1")
    )
}

pub fn apply_local_token_if_asr_loopback(req: RequestBuilder, url: &str) -> RequestBuilder {
    if is_asr_loopback_url(url) {
        apply_local_token_header(req)
    } else {
        req
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_loopback_asr_urls() {
        assert!(is_asr_loopback_url("http://127.0.0.1:8741/v1/transcribe"));
        assert!(is_asr_loopback_url("http://localhost:8741/health"));
        assert!(!is_asr_loopback_url(
            "https://api.openai.com/v1/audio/transcriptions"
        ));
        assert!(!is_asr_loopback_url(
            "http://192.168.1.1:8741/v1/transcribe"
        ));
    }

    #[test]
    fn managed_token_preferred_over_env() {
        clear_managed_local_token();
        set_managed_local_token(Some("managed-token".into()));
        assert_eq!(
            resolve_local_token_for_request().as_deref(),
            Some("managed-token")
        );
        clear_managed_local_token();
    }
}

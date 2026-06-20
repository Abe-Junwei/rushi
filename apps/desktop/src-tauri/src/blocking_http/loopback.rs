use std::sync::OnceLock;
use std::time::Duration;

use reqwest::blocking::Client;
use serde_json::Value;

static LOOPBACK_CLIENT: OnceLock<Client> = OnceLock::new();
static LOOPBACK_POST_CLIENT: OnceLock<Client> = OnceLock::new();

fn client() -> &'static Client {
    LOOPBACK_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(8))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

fn post_client() -> &'static Client {
    LOOPBACK_POST_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(600))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

pub fn loopback_get_json(url: &str) -> Option<Value> {
    let resp = client().get(url).send().ok()?;
    if !resp.status().is_success() {
        return None;
    }
    resp.json().ok()
}

pub fn loopback_get_text(url: &str) -> Option<String> {
    let resp = client().get(url).send().ok()?;
    if !resp.status().is_success() {
        return None;
    }
    resp.text().ok()
}

/// GET loopback URL; returns response even when status is non-success (port probe).
pub fn loopback_get_send(url: &str) -> Result<reqwest::blocking::Response, reqwest::Error> {
    client().get(url).send()
}

/// POST with empty body; for long-running sidecar routes (e.g. model warmup).
pub fn loopback_post_ok(
    url: &str,
    _timeout_secs: u64,
    extra_headers: &[(&str, &str)],
) -> Result<(), String> {
    // Process-wide client only — never build/drop an ephemeral reqwest::blocking runtime here.
    let client = post_client();
    let mut req = client.post(url);
    for (name, value) in extra_headers {
        req = req.header(*name, *value);
    }
    let resp = req
        .send()
        .map_err(|e| format!("loopback POST failed: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().unwrap_or_default();
        return Err(format!("loopback POST HTTP {status}: {body}"));
    }
    Ok(())
}

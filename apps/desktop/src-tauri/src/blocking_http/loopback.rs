use std::sync::OnceLock;
use std::time::Duration;

use reqwest::blocking::Client;
use serde_json::Value;

static LOOPBACK_CLIENT: OnceLock<Client> = OnceLock::new();

fn client() -> &'static Client {
    LOOPBACK_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(8))
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

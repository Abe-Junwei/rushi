//! 在线 STT 健康探测（设置页「探测连接」）。
//!
//! 使用 **reqwest blocking 客户端 + 同步 Tauri 命令**，与转写生产能力隔离；
//! URL 策略与 `online_stt_bridge::is_allowed_stt_transcribe_url` 一致。

use crate::online_stt_bridge::is_allowed_stt_transcribe_url;
use crate::project::utils::append_desktop_log_line;
use crate::DbState;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tauri::State;

static PROBE_BLOCKING_CLIENT: OnceLock<Client> = OnceLock::new();
static PROBE_BLOCKING_DIRECT: OnceLock<Client> = OnceLock::new();

fn probe_blocking_client(use_system_proxy: bool) -> &'static Client {
    if use_system_proxy {
        PROBE_BLOCKING_CLIENT.get_or_init(|| build_probe_blocking_client(true))
    } else {
        PROBE_BLOCKING_DIRECT.get_or_init(|| build_probe_blocking_client(false))
    }
}

fn build_probe_blocking_client(use_system_proxy: bool) -> Client {
    let mut builder = Client::builder()
        .connect_timeout(Duration::from_secs(6))
        .user_agent(format!("rushi-desktop/{}", env!("CARGO_PKG_VERSION")));
    if !use_system_proxy {
        builder = builder.no_proxy();
    }
    builder
        .build()
        .expect("reqwest blocking stt probe client build")
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttOnlineProbeRequest {
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttOnlineProbeResponse {
    pub state: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

fn clamp_timeout_ms(raw: u64) -> Duration {
    Duration::from_millis(raw.clamp(1_000, 600_000))
}

fn headers_from_map(raw: &HashMap<String, String>) -> HeaderMap {
    let mut map = HeaderMap::new();
    for (k, v) in raw {
        let Ok(name) = HeaderName::from_str(k.trim()) else {
            continue;
        };
        if let Ok(value) = HeaderValue::from_str(v) {
            map.insert(name, value);
        }
    }
    map
}

pub(crate) fn probe_stt_online_health_blocking(
    req: &SttOnlineProbeRequest,
) -> SttOnlineProbeResponse {
    let endpoint = req.url.trim().to_string();
    if endpoint.is_empty() {
        return SttOnlineProbeResponse {
            state: "unconfigured".into(),
            available: false,
            endpoint: None,
            status: None,
            latency_ms: None,
            message: Some("未配置在线 STT URL。".into()),
        };
    }
    if !is_allowed_stt_transcribe_url(&endpoint) {
        return SttOnlineProbeResponse {
            state: "unconfigured".into(),
            available: false,
            endpoint: Some(endpoint),
            status: None,
            latency_ms: None,
            message: Some(
                "在线 STT 端点须使用 HTTPS；仅 localhost / 127.0.0.1 / ::1 允许 HTTP。".into(),
            ),
        };
    }

    let timeout = clamp_timeout_ms(req.timeout_ms);
    let headers = headers_from_map(&req.headers);

    let primary = send_probe_get(probe_blocking_client(true), &endpoint, &headers, timeout);
    if should_retry_without_proxy(&primary) {
        let retried = send_probe_get(probe_blocking_client(false), &endpoint, &headers, timeout);
        if retried.available || retried.status.is_some() || retried.state != "network-error" {
            return retried;
        }
    }
    primary
}

fn should_retry_without_proxy(out: &SttOnlineProbeResponse) -> bool {
    matches!(out.state.as_str(), "timeout" | "network-error")
}

fn send_probe_get(
    client: &Client,
    endpoint: &str,
    headers: &HeaderMap,
    timeout: Duration,
) -> SttOnlineProbeResponse {
    let t0 = Instant::now();
    let mut req = client
        .get(endpoint)
        .header("accept", "application/json")
        .timeout(timeout);
    for (name, value) in headers.iter() {
        req = req.header(name, value);
    }

    match req.send() {
        Ok(resp) => map_http_status(resp.status().as_u16(), endpoint, t0.elapsed()),
        Err(e) if e.is_timeout() => SttOnlineProbeResponse {
            state: "timeout".into(),
            available: false,
            endpoint: Some(endpoint.to_string()),
            status: None,
            latency_ms: Some(t0.elapsed().as_millis() as u64),
            message: Some(format!("探测超时（{}ms）。", timeout.as_millis())),
        },
        Err(e) if e.is_connect() => SttOnlineProbeResponse {
            state: "network-error".into(),
            available: false,
            endpoint: Some(endpoint.to_string()),
            status: None,
            latency_ms: Some(t0.elapsed().as_millis() as u64),
            message: Some(format!("无法连接：{e}")),
        },
        Err(e) => SttOnlineProbeResponse {
            state: "network-error".into(),
            available: false,
            endpoint: Some(endpoint.to_string()),
            status: None,
            latency_ms: Some(t0.elapsed().as_millis() as u64),
            message: Some(e.to_string()),
        },
    }
}

fn map_http_status(status: u16, endpoint: &str, elapsed: Duration) -> SttOnlineProbeResponse {
    let latency_ms = Some(elapsed.as_millis() as u64);
    let endpoint = Some(endpoint.to_string());
    if (200..300).contains(&status) {
        return SttOnlineProbeResponse {
            state: "available".into(),
            available: true,
            endpoint,
            status: Some(status),
            latency_ms,
            message: None,
        };
    }
    if status == 401 {
        return SttOnlineProbeResponse {
            state: "unauthorized".into(),
            available: false,
            endpoint,
            status: Some(status),
            latency_ms,
            message: Some("密钥被拒绝 (401)。".into()),
        };
    }
    if status == 403 {
        return SttOnlineProbeResponse {
            state: "forbidden".into(),
            available: false,
            endpoint,
            status: Some(status),
            latency_ms,
            message: Some("访问被拒绝 (403)。".into()),
        };
    }
    if status == 405 {
        return SttOnlineProbeResponse {
            state: "method-not-allowed".into(),
            available: false,
            endpoint,
            status: Some(status),
            latency_ms,
            message: Some(
                "端点可达但不接受 GET；请确认转写 POST URL 正确，或使用厂商默认探测点。".into(),
            ),
        };
    }
    SttOnlineProbeResponse {
        state: "http-error".into(),
        available: false,
        endpoint,
        status: Some(status),
        latency_ms,
        message: Some(format!("HTTP {status}")),
    }
}

#[tauri::command]
pub async fn stt_probe_online_health(
    state: State<'_, DbState>,
    req: SttOnlineProbeRequest,
) -> Result<SttOnlineProbeResponse, String> {
    append_desktop_log_line(
        &state,
        &format!("INFO stt_probe_start url={}", req.url.trim()),
    );
    let out = tauri::async_runtime::spawn_blocking(move || {
        probe_stt_online_health_blocking(&req)
    })
    .await
    .map_err(|e| format!("探测任务被取消：{e}"))?;
    let level = if out.available { "INFO" } else { "WARN" };
    append_desktop_log_line(
        &state,
        &format!(
            "{level} stt_probe_done state={} status={} latency_ms={} message={}",
            out.state,
            out.status
                .map(|x| x.to_string())
                .unwrap_or_else(|| "-".to_string()),
            out.latency_ms
                .map(|x| x.to_string())
                .unwrap_or_else(|| "-".to_string()),
            out.message.as_deref().unwrap_or("-"),
        ),
    );
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_disallowed_url_before_request() {
        let out = probe_stt_online_health_blocking(&SttOnlineProbeRequest {
            url: "http://evil.com/probe".into(),
            headers: HashMap::new(),
            timeout_ms: 5_000,
        });
        assert_eq!(out.state, "unconfigured");
        assert!(!out.available);
    }

    #[test]
    fn maps_status_codes() {
        let ok = map_http_status(200, "https://api.example.com/", Duration::from_millis(42));
        assert!(ok.available);
        assert_eq!(ok.state, "available");
        assert_eq!(ok.latency_ms, Some(42));

        let u401 = map_http_status(401, "https://api.example.com/", Duration::ZERO);
        assert_eq!(u401.state, "unauthorized");

        let f403 = map_http_status(403, "https://api.example.com/", Duration::ZERO);
        assert_eq!(f403.state, "forbidden");

        let m405 = map_http_status(405, "https://api.example.com/", Duration::ZERO);
        assert_eq!(m405.state, "method-not-allowed");

        let err = map_http_status(500, "https://api.example.com/", Duration::ZERO);
        assert_eq!(err.state, "http-error");
    }
}

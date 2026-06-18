//! 讯飞凭证探测：对 OST query 发签名 POST，验证三件套并测量 RTT。

use std::time::{Duration, Instant};

use reqwest::blocking::RequestBuilder;
use serde_json::json;

use crate::blocking_http::stt_probe_blocking_client;
use crate::stt_online_probe::SttOnlineProbeResponse;

use super::auth::signed_json_headers;
use super::task::{QUERY_PATH, XUNFEI_OST_HOST};

fn probe_client() -> &'static crate::blocking_http::BlockingClient {
    stt_probe_blocking_client(true)
}

fn auth_failure_message(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.contains("apikey not found")
        || lower.contains("unauthorized")
        || lower.contains("signature cannot be verified")
        || lower.contains("hmac")
}

pub fn probe_credentials_blocking(
    app_id: &str,
    api_key: &str,
    api_secret: &str,
    timeout: Duration,
) -> SttOnlineProbeResponse {
    let endpoint = format!("https://{XUNFEI_OST_HOST}{QUERY_PATH}");
    let payload = json!({
        "common": { "app_id": app_id.trim() },
        "business": { "task_id": "rushi-probe-invalid-task-id" },
    });
    let body = match serde_json::to_vec(&payload) {
        Ok(b) => b,
        Err(e) => {
            return SttOnlineProbeResponse {
                state: "unknown-error".into(),
                available: false,
                endpoint: Some(endpoint),
                status: None,
                latency_ms: None,
                message: Some(format!("序列化探测请求: {e}")),
            };
        }
    };

    let t0 = Instant::now();
    let url = endpoint.clone();
    let mut req: RequestBuilder = probe_client()
        .post(&url)
        .header("accept", "application/json")
        .timeout(timeout);
    for (k, v) in signed_json_headers(XUNFEI_OST_HOST, QUERY_PATH, &body, api_key, api_secret) {
        req = req.header(k, v);
    }
    let resp = match req.body(body).send() {
        Ok(r) => r,
        Err(e) if e.is_timeout() => {
            return SttOnlineProbeResponse {
                state: "timeout".into(),
                available: false,
                endpoint: Some(endpoint),
                status: None,
                latency_ms: Some(t0.elapsed().as_millis() as u64),
                message: Some(format!("探测超时（{}ms）。", timeout.as_millis())),
            };
        }
        Err(e) if e.is_connect() => {
            return SttOnlineProbeResponse {
                state: "network-error".into(),
                available: false,
                endpoint: Some(endpoint),
                status: None,
                latency_ms: Some(t0.elapsed().as_millis() as u64),
                message: Some(format!("无法连接讯飞 OST：{e}")),
            };
        }
        Err(e) => {
            return SttOnlineProbeResponse {
                state: "network-error".into(),
                available: false,
                endpoint: Some(endpoint),
                status: None,
                latency_ms: Some(t0.elapsed().as_millis() as u64),
                message: Some(e.to_string()),
            };
        }
    };

    let latency_ms = Some(t0.elapsed().as_millis() as u64);
    let status = resp.status().as_u16();
    let text = resp.text().unwrap_or_default();

    if status == 401 || (status == 403 && auth_failure_message(&text)) {
        return SttOnlineProbeResponse {
            state: "unauthorized".into(),
            available: false,
            endpoint: Some(endpoint),
            status: Some(status),
            latency_ms,
            message: Some("讯飞凭证被拒绝，请检查 AppID、APISecret、APIKey。".into()),
        };
    }
    if auth_failure_message(&text) {
        return SttOnlineProbeResponse {
            state: "unauthorized".into(),
            available: false,
            endpoint: Some(endpoint),
            status: Some(status),
            latency_ms,
            message: Some("讯飞凭证校验失败，请检查 AppID、APISecret、APIKey。".into()),
        };
    }
    if (200..300).contains(&status) {
        return SttOnlineProbeResponse {
            state: "available".into(),
            available: true,
            endpoint: Some(endpoint),
            status: Some(status),
            latency_ms,
            message: Some(
                "讯飞 OST 可达，凭证已通过签名校验；首次转写以实际上传结果为准。".into(),
            ),
        };
    }
    SttOnlineProbeResponse {
        state: "http-error".into(),
        available: false,
        endpoint: Some(endpoint),
        status: Some(status),
        latency_ms,
        message: Some(format!("讯飞 OST HTTP {status}: {text}")),
    }
}

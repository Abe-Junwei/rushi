//! 讯飞凭证探测：对 OST query 发签名 POST，验证三件套并测量 RTT。

use std::time::{Duration, Instant};

use reqwest::blocking::RequestBuilder;
use serde_json::{json, Value};

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

fn parse_ost_json(text: &str) -> Option<Value> {
    serde_json::from_str(text.trim()).ok()
}

fn ost_api_code(j: &Value) -> Option<i64> {
    j.get("code")
        .and_then(|c| c.as_i64().or_else(|| c.as_str().and_then(|s| s.parse().ok())))
}

fn ost_api_message(j: &Value) -> Option<&str> {
    j.get("message")
        .or_else(|| j.get("desc"))
        .and_then(|m| m.as_str())
}

/// 探测用假 task_id 时，讯飞常返回 HTTP 500 + code 10401「no data found」——表示签名校验已通过。
fn is_probe_task_not_found_success(j: &Value) -> bool {
    if ost_api_code(j) == Some(10401) {
        return true;
    }
    ost_api_message(j)
        .map(|m| m.eq_ignore_ascii_case("no data found"))
        .unwrap_or(false)
}

fn credentials_probe_success(
    endpoint: String,
    status: u16,
    latency_ms: Option<u64>,
) -> SttOnlineProbeResponse {
    SttOnlineProbeResponse {
        state: "available".into(),
        available: true,
        endpoint: Some(endpoint),
        status: Some(status),
        latency_ms,
        message: Some(
            "讯飞 OST 可达，凭证已通过签名校验；首次转写以实际上传结果为准。".into(),
        ),
    }
}

fn interpret_probe_response(
    endpoint: String,
    status: u16,
    text: &str,
    latency_ms: Option<u64>,
) -> SttOnlineProbeResponse {
    if status == 401 || (status == 403 && auth_failure_message(text)) {
        return SttOnlineProbeResponse {
            state: "unauthorized".into(),
            available: false,
            endpoint: Some(endpoint),
            status: Some(status),
            latency_ms,
            message: Some("讯飞凭证被拒绝，请检查 AppID、APISecret、APIKey。".into()),
        };
    }
    if auth_failure_message(text) {
        return SttOnlineProbeResponse {
            state: "unauthorized".into(),
            available: false,
            endpoint: Some(endpoint),
            status: Some(status),
            latency_ms,
            message: Some("讯飞凭证校验失败，请检查 AppID、APISecret、APIKey。".into()),
        };
    }

    if let Some(j) = parse_ost_json(text) {
        if ost_api_code(&j) == Some(0) || is_probe_task_not_found_success(&j) {
            return credentials_probe_success(endpoint, status, latency_ms);
        }
        if let Some(msg) = ost_api_message(&j) {
            return SttOnlineProbeResponse {
                state: "http-error".into(),
                available: false,
                endpoint: Some(endpoint),
                status: Some(status),
                latency_ms,
                message: Some(format!("讯飞 OST 错误 {}：{msg}", ost_api_code(&j).unwrap_or(-1))),
            };
        }
    }

    if (200..300).contains(&status) {
        return credentials_probe_success(endpoint, status, latency_ms);
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

    interpret_probe_response(endpoint, status, &text, latency_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_treats_missing_task_as_credentials_ok() {
        let text = r#"{"code":10401,"message":"no data found","sid":"ost000"}"#;
        let j = parse_ost_json(text).expect("json");
        assert!(is_probe_task_not_found_success(&j));
        let out = interpret_probe_response(
            "https://ost-api.xfyun.cn/v2/ost/query".into(),
            500,
            text,
            Some(42),
        );
        assert!(out.available);
        assert_eq!(out.state, "available");
        assert_eq!(out.latency_ms, Some(42));
    }

    #[test]
    fn probe_treats_auth_failure_as_unauthorized() {
        let text = r#"{"message":"HMAC signature cannot be verified: apikey not found"}"#;
        let out = interpret_probe_response(
            "https://ost-api.xfyun.cn/v2/ost/query".into(),
            401,
            text,
            Some(10),
        );
        assert!(!out.available);
        assert_eq!(out.state, "unauthorized");
    }
}

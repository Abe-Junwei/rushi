//! 讯飞 OST 凭证探测 — blocking POST（须在 `spawn_blocking` 内调用）。

use std::time::{Duration, Instant};

use reqwest::blocking::RequestBuilder;

use super::stt_probe_blocking_client;

#[derive(Debug)]
pub enum XunfeiOstProbeTransport {
    Ok {
        status: u16,
        text: String,
        latency_ms: u64,
    },
    Timeout {
        latency_ms: u64,
        timeout: Duration,
    },
    Connect {
        latency_ms: u64,
        message: String,
    },
    Other {
        latency_ms: u64,
        message: String,
    },
}

/// 对已签名 OST query 请求发 blocking POST。
pub fn send_ost_credentials_probe(
    endpoint: &str,
    body: Vec<u8>,
    signed_headers: impl IntoIterator<Item = (String, String)>,
    timeout: Duration,
) -> XunfeiOstProbeTransport {
    let t0 = Instant::now();
    let mut req: RequestBuilder = stt_probe_blocking_client(true)
        .post(endpoint)
        .header("accept", "application/json")
        .timeout(timeout);
    for (k, v) in signed_headers {
        req = req.header(k, v);
    }
    match req.body(body).send() {
        Ok(resp) => {
            let latency_ms = t0.elapsed().as_millis() as u64;
            let status = resp.status().as_u16();
            let text = resp.text().unwrap_or_default();
            XunfeiOstProbeTransport::Ok {
                status,
                text,
                latency_ms,
            }
        }
        Err(e) if e.is_timeout() => XunfeiOstProbeTransport::Timeout {
            latency_ms: t0.elapsed().as_millis() as u64,
            timeout,
        },
        Err(e) if e.is_connect() => XunfeiOstProbeTransport::Connect {
            latency_ms: t0.elapsed().as_millis() as u64,
            message: format!("无法连接讯飞 OST：{e}"),
        },
        Err(e) => XunfeiOstProbeTransport::Other {
            latency_ms: t0.elapsed().as_millis() as u64,
            message: e.to_string(),
        },
    }
}

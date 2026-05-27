use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

use super::ASR_HEALTH_URL;

pub fn is_rushi_asr_health_json(v: &Value) -> bool {
    v.get("service").and_then(|s| s.as_str()) == Some("rushi-asr")
        && v.get("status").and_then(|s| s.as_str()) == Some("ok")
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AsrPortStatus {
    Free,
    RushiAsr,
    Foreign,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrPortProbe {
    pub status: AsrPortStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Classify who is listening on loopback :8741.
pub async fn probe_asr_port() -> AsrPortProbe {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let resp = match client.get(ASR_HEALTH_URL).send().await {
        Ok(resp) => resp,
        Err(_) => {
            return if loopback_port_accepts_tcp(super::ASR_LOOPBACK_PORT) {
                AsrPortProbe {
                    status: AsrPortStatus::Foreign,
                    http_status: None,
                    detail: Some(
                        "8741 已有服务监听，但未能按 rushi-asr /health 响应；可能是其他进程占用，或是仍在启动中的旧实例。请稍候重试；若持续存在，请结束占用进程。".into(),
                    ),
                }
            } else {
                AsrPortProbe {
                    status: AsrPortStatus::Free,
                    http_status: None,
                    detail: Some("8741 端口无监听，可启动内置侧车。".into()),
                }
            };
        }
    };
    let http_status = resp.status().as_u16();
    let text = resp.text().await.unwrap_or_default();
    let Ok(v) = serde_json::from_str::<Value>(&text) else {
        return AsrPortProbe {
            status: AsrPortStatus::Foreign,
            http_status: Some(http_status),
            detail: Some(format!(
                "8741 有服务响应，但不是 rushi-asr /health JSON（HTTP {http_status}）。请先结束占用该端口的其他进程。"
            )),
        };
    };
    if is_rushi_asr_health_json(&v) {
        return AsrPortProbe {
            status: AsrPortStatus::RushiAsr,
            http_status: Some(http_status),
            detail: None,
        };
    }
    let service = v.get("service").and_then(|s| s.as_str()).unwrap_or("未知");
    AsrPortProbe {
        status: AsrPortStatus::Foreign,
        http_status: Some(http_status),
        detail: Some(format!(
            "8741 已被其他服务占用（service={service}，HTTP {http_status}）。内置侧车无法同端口启动。"
        )),
    }
}

async fn fetch_loopback_root_json() -> Option<Value> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let resp = client.get("http://127.0.0.1:8741/").send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let text = resp.text().await.ok()?;
    serde_json::from_str::<Value>(&text).ok()
}

/// True when loopback rushi-asr exposes R3g model catalog (fresh PyInstaller build).
pub fn bundled_sidecar_supports_model_catalog() -> bool {
    tauri::async_runtime::block_on(async {
        let Some(v) = fetch_loopback_root_json().await else {
            return false;
        };
        v.get("model_catalog").is_some()
            || v.get("local_asr_model_catalog").is_some()
            || v.get("prepare_model_async")
                .and_then(|s| s.as_str())
                .is_some_and(|s| s.contains("/v1/models/prepare/async"))
    })
}

/// True when loopback rushi-asr includes Paraformer punc prepare + cancel (2026-05-27+ build).
pub fn bundled_sidecar_supports_punc_prepare() -> bool {
    tauri::async_runtime::block_on(async {
        let Some(v) = fetch_loopback_root_json().await else {
            return false;
        };
        v.get("prepare_cancel")
            .and_then(|s| s.as_str())
            .is_some_and(|s| s.contains("/v1/models/prepare-cancel"))
    })
}

pub(crate) fn loopback_port_accepts_tcp(port: u16) -> bool {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    TcpStream::connect_timeout(&addr.into(), Duration::from_millis(250)).is_ok()
}

/// True when `GET /health` returns JSON that looks like **this** rushi-asr (not merely "something on :8741").
pub fn bundled_health_looks_like_rushi_asr() -> bool {
    tauri::async_runtime::block_on(async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let Ok(resp) = client.get(ASR_HEALTH_URL).send().await else {
            return false;
        };
        if !resp.status().is_success() {
            return false;
        }
        let Ok(text) = resp.text().await else {
            return false;
        };
        let Ok(v): Result<Value, _> = serde_json::from_str(&text) else {
            return false;
        };
        is_rushi_asr_health_json(&v)
    })
}

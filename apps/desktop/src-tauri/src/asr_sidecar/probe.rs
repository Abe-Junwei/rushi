use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::time::Duration;

use crate::blocking_http::{loopback_get_json, loopback_get_send, loopback_get_text};
use serde::Serialize;
use serde_json::Value;

use super::ASR_HEALTH_URL;

const LOOPBACK_PREPARE_STATUS_URL: &str = "http://127.0.0.1:8741/v1/models/prepare-status";

const LOOPBACK_ROOT_URL: &str = "http://127.0.0.1:8741/";

fn fetch_loopback_health_json_sync() -> Option<Value> {
    loopback_get_json(ASR_HEALTH_URL)
}

fn fetch_loopback_root_json_sync() -> Option<Value> {
    let text = loopback_get_text(LOOPBACK_ROOT_URL)?;
    serde_json::from_str::<Value>(&text).ok()
}

pub fn is_rushi_asr_health_json(v: &Value) -> bool {
    v.get("service").and_then(|s| s.as_str()) == Some("rushi-asr")
        && v.get("status").and_then(|s| s.as_str()) == Some("ok")
}

pub fn health_declares_local_token_required(v: &Value) -> bool {
    v.get("local_token_required")
        .and_then(|x| x.as_bool())
        .unwrap_or(false)
}

/// True when loopback rushi-asr was started with `RUSHI_LOCAL_TOKEN` (mutating routes need header).
pub fn loopback_local_token_required() -> bool {
    let Some(v) = fetch_loopback_health_json_sync() else {
        return false;
    };
    if !is_rushi_asr_health_json(&v) {
        return false;
    }
    health_declares_local_token_required(&v)
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum AsrHealthBody {
    Ok(Value),
    HttpError(u16),
    Unreachable,
}

/// Single GET /health for port classification + parsed rushi-asr capabilities.
pub async fn probe_asr_port_and_health() -> (AsrPortProbe, AsrHealthBody) {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let resp = match client.get(ASR_HEALTH_URL).send().await {
        Ok(resp) => resp,
        Err(_) => {
            return (
                probe_asr_port_when_health_unreachable(),
                AsrHealthBody::Unreachable,
            );
        }
    };
    let http_status = resp.status().as_u16();
    let success = resp.status().is_success();
    let text = resp.text().await.unwrap_or_default();
    if !success {
        return (
            classify_asr_port_probe(http_status, &text),
            AsrHealthBody::HttpError(http_status),
        );
    }
    let Ok(v) = serde_json::from_str::<Value>(&text) else {
        return (
            classify_asr_port_probe(http_status, &text),
            AsrHealthBody::Unreachable,
        );
    };
    if is_rushi_asr_health_json(&v) {
        (
            AsrPortProbe {
                status: AsrPortStatus::RushiAsr,
                http_status: Some(http_status),
                detail: None,
            },
            AsrHealthBody::Ok(v),
        )
    } else {
        (
            classify_asr_port_probe(http_status, &text),
            AsrHealthBody::Unreachable,
        )
    }
}

/// Sync probe for diagnostic export (via `blocking_http` inside sync command path).
pub fn probe_asr_port_sync() -> AsrPortProbe {
    let resp = match loopback_get_send(ASR_HEALTH_URL) {
        Ok(resp) => resp,
        Err(_) => return probe_asr_port_when_health_unreachable(),
    };
    let http_status = resp.status().as_u16();
    let text = resp.text().unwrap_or_default();
    classify_asr_port_probe(http_status, &text)
}

fn probe_asr_port_when_health_unreachable() -> AsrPortProbe {
    if loopback_port_accepts_tcp(super::ASR_LOOPBACK_PORT) {
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
    }
}

fn classify_asr_port_probe(http_status: u16, text: &str) -> AsrPortProbe {
    let Ok(v) = serde_json::from_str::<Value>(text) else {
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

/// True when loopback rushi-asr exposes R3g model catalog (fresh PyInstaller build).
pub fn loopback_root_declares_model_catalog(v: &Value) -> bool {
    v.get("model_catalog").is_some()
        || v.get("local_asr_model_catalog").is_some()
        || v.get("prepare_model_async")
            .and_then(|s| s.as_str())
            .is_some_and(|s| s.contains("/v1/models/prepare/async"))
}

/// True when loopback rushi-asr includes Paraformer punc prepare + cancel (2026-05-27+ build).
pub fn loopback_root_declares_punc_prepare(v: &Value) -> bool {
    v.get("prepare_cancel")
        .and_then(|s| s.as_str())
        .is_some_and(|s| s.contains("/v1/models/prepare-cancel"))
}

/// True when loopback rushi-asr exposes R3e-C async transcribe job API.
pub fn loopback_root_declares_transcribe_async(v: &Value) -> bool {
    v.get("transcribe_async")
        .and_then(|s| s.as_str())
        .is_some_and(|s| s.contains("/v1/transcribe/async"))
}

/// True when loopback rushi-asr root catalog looks like a current bundled build.
pub fn bundled_sidecar_is_fresh_build() -> bool {
    bundled_sidecar_supports_model_catalog()
        && bundled_sidecar_supports_punc_prepare()
        && bundled_sidecar_supports_transcribe_async()
}

/// True when loopback rushi-asr exposes R3g model catalog (fresh PyInstaller build).
pub fn bundled_sidecar_supports_model_catalog() -> bool {
    let Some(v) = fetch_loopback_root_json_sync() else {
        return false;
    };
    loopback_root_declares_model_catalog(&v)
}

/// True when loopback rushi-asr includes Paraformer punc prepare + cancel (2026-05-27+ build).
pub fn bundled_sidecar_supports_punc_prepare() -> bool {
    let Some(v) = fetch_loopback_root_json_sync() else {
        return false;
    };
    loopback_root_declares_punc_prepare(&v)
}

/// True when loopback rushi-asr includes R3e-C async transcribe (2026-05-30+ build).
pub fn bundled_sidecar_supports_transcribe_async() -> bool {
    let Some(v) = fetch_loopback_root_json_sync() else {
        return false;
    };
    loopback_root_declares_transcribe_async(&v)
}

pub(crate) fn loopback_port_accepts_tcp(port: u16) -> bool {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    TcpStream::connect_timeout(&addr.into(), Duration::from_millis(250)).is_ok()
}

/// True when `GET /health` returns JSON that looks like **this** rushi-asr (not merely "something on :8741").
pub fn bundled_health_looks_like_rushi_asr() -> bool {
    let Some(v) = fetch_loopback_health_json_sync() else {
        return false;
    };
    is_rushi_asr_health_json(&v)
}

/// True when loopback prepare-status indicates an active, non-stale download.
pub(crate) fn prepare_status_json_is_active_running(v: &serde_json::Value) -> bool {
    if v.get("phase").and_then(|p| p.as_str()) != Some("running") {
        return false;
    }
    !v.get("stale").and_then(|s| s.as_bool()).unwrap_or(false)
}

/// True when async model prefetch is in progress (watchdog should not treat slow /health as dead).
pub fn loopback_model_prepare_running() -> bool {
    let Some(v) = fetch_loopback_prepare_status_json() else {
        return false;
    };
    prepare_status_json_is_active_running(&v)
}

/// True when weights are on disk but not loaded into memory (defer auto-warmup to first transcribe).
pub fn loopback_models_cached_not_memory_ready() -> bool {
    let Some(v) = fetch_loopback_health_json_sync() else {
        return false;
    };
    if !is_rushi_asr_health_json(&v) {
        return false;
    }
    let required_cached = v
        .get("funasr_required_models_cached")
        .and_then(|x| x.as_bool())
        == Some(true);
    let selected_ready = v.get("selected_model_ready").and_then(|x| x.as_bool()) == Some(true);
    required_cached && !selected_ready
}

pub fn fetch_loopback_prepare_status_json() -> Option<serde_json::Value> {
    loopback_get_json(LOOPBACK_PREPARE_STATUS_URL)
}

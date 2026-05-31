//! OpenAI 兼容 LLM 连通性探测（设置页「探测连接」）。
//!
//! 使用 **reqwest blocking 客户端 + 同步 Tauri 命令**，与 async 生产能力（自动标点）隔离，
//! 避免共享 `http_client()` 在部分 runtime 组合下 `.await` 永久挂起。
//!
//! 策略：
//! 1. 主路径：`POST /chat/completions`（max_tokens=1）——与自动标点相同 endpoint。
//! 2. 404/405 回退 `GET /models`。
//! 3. 传输失败：`no_proxy` blocking 客户端重试一次。
//! 4. 全程硬 deadline，保证 IPC 在 ~20s 内返回。

use super::{build_postprocess_models_endpoint, LlmProbeConnectionResponse, PostprocessConfig};
use reqwest::blocking::Client;
use serde_json::json;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use url::Url;

pub(crate) const PROBE_TIMEOUT: Duration = Duration::from_secs(12);
pub(crate) const PROBE_TOTAL_DEADLINE: Duration = Duration::from_secs(20);

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
        .timeout(PROBE_TIMEOUT)
        .user_agent(format!("rushi-desktop/{}", env!("CARGO_PKG_VERSION")));
    if !use_system_proxy {
        builder = builder.no_proxy();
    }
    builder
        .build()
        .expect("reqwest blocking probe client build")
}

pub(crate) fn probe_llm_connection_blocking(
    config: &PostprocessConfig,
    per_attempt_timeout: Duration,
) -> LlmProbeConnectionResponse {
    let deadline = Instant::now() + PROBE_TOTAL_DEADLINE;
    let input = LlmProbeInput {
        chat_endpoint: config.endpoint.clone(),
        model: config.model.clone(),
        api_key: config.api_key.clone(),
    };
    probe_llm_connection(&input, per_attempt_timeout, deadline)
}

struct LlmProbeInput {
    chat_endpoint: Url,
    model: String,
    api_key: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LlmProbeMethod {
    ChatCompletionPing,
    ModelsList,
}

impl LlmProbeMethod {
    fn as_str(self) -> &'static str {
        match self {
            Self::ChatCompletionPing => "chat_completion_ping",
            Self::ModelsList => "models_list",
        }
    }
}

fn remaining_timeout(deadline: Instant, fallback: Duration) -> Duration {
    deadline
        .checked_duration_since(Instant::now())
        .unwrap_or(Duration::ZERO)
        .min(fallback)
}

fn probe_llm_connection(
    input: &LlmProbeInput,
    per_attempt_timeout: Duration,
    deadline: Instant,
) -> LlmProbeConnectionResponse {
    if Instant::now() >= deadline {
        return deadline_exceeded_response(&input.chat_endpoint.to_string());
    }
    let attempt_timeout = remaining_timeout(deadline, per_attempt_timeout);
    if attempt_timeout.is_zero() {
        return deadline_exceeded_response(&input.chat_endpoint.to_string());
    }

    match send_chat_completion_ping(probe_blocking_client(true), input, attempt_timeout) {
        out if out.ok => attach_method(out, LlmProbeMethod::ChatCompletionPing),
        out if is_definitive_auth_failure(out.status) => {
            attach_method(out, LlmProbeMethod::ChatCompletionPing)
        }
        out if should_fallback_to_models_list(out.status) => {
            let models_url = build_postprocess_models_endpoint(&input.chat_endpoint);
            let attempt_timeout = remaining_timeout(deadline, per_attempt_timeout);
            if attempt_timeout.is_zero() {
                return attach_method(
                    deadline_exceeded_response(&models_url.to_string()),
                    LlmProbeMethod::ModelsList,
                );
            }
            match send_models_list(probe_blocking_client(true), input, &models_url, attempt_timeout)
            {
                fallback if fallback.ok || is_definitive_auth_failure(fallback.status) => {
                    attach_method(fallback, LlmProbeMethod::ModelsList)
                }
                _ => attach_method(out, LlmProbeMethod::ChatCompletionPing),
            }
        }
        out if out.status.is_none() && is_retryable_transport(&out.message) => {
            if let Some(retried) = retry_transport(input, per_attempt_timeout, deadline) {
                retried
            } else {
                attach_method(out, LlmProbeMethod::ChatCompletionPing)
            }
        }
        out => attach_method(out, LlmProbeMethod::ChatCompletionPing),
    }
}

fn retry_transport(
    input: &LlmProbeInput,
    per_attempt_timeout: Duration,
    deadline: Instant,
) -> Option<LlmProbeConnectionResponse> {
    let attempt_timeout = remaining_timeout(deadline, per_attempt_timeout);
    if attempt_timeout.is_zero() {
        return None;
    }
    let out = send_chat_completion_ping(probe_blocking_client(false), input, attempt_timeout);
    if out.ok || out.status.is_some() {
        return Some(attach_method(
            enrich_direct_retry_message(out),
            LlmProbeMethod::ChatCompletionPing,
        ));
    }
    let models_url = build_postprocess_models_endpoint(&input.chat_endpoint);
    let attempt_timeout = remaining_timeout(deadline, per_attempt_timeout);
    if attempt_timeout.is_zero() {
        return None;
    }
    let out = send_models_list(probe_blocking_client(false), input, &models_url, attempt_timeout);
    if out.ok || out.status.is_some() {
        return Some(attach_method(
            enrich_direct_retry_message(out),
            LlmProbeMethod::ModelsList,
        ));
    }
    None
}

fn enrich_direct_retry_message(mut out: LlmProbeConnectionResponse) -> LlmProbeConnectionResponse {
    if out.ok {
        out.message = format!("{}（已绕过系统代理重试）", out.message);
    }
    out
}

fn attach_method(
    mut out: LlmProbeConnectionResponse,
    method: LlmProbeMethod,
) -> LlmProbeConnectionResponse {
    out.probe_method = Some(method.as_str().to_string());
    out
}

fn deadline_exceeded_response(endpoint: &str) -> LlmProbeConnectionResponse {
    LlmProbeConnectionResponse {
        ok: false,
        status: None,
        message: format!(
            "探测超时（{endpoint}），总时限 {}s。请检查网络、系统代理或 API 基址。",
            PROBE_TOTAL_DEADLINE.as_secs()
        ),
        latency_ms: None,
        probe_method: None,
        endpoint: Some(endpoint.to_string()),
    }
}

fn is_definitive_auth_failure(status: Option<u16>) -> bool {
    matches!(status, Some(401 | 403))
}

fn should_fallback_to_models_list(status: Option<u16>) -> bool {
    matches!(status, Some(404 | 405))
}

fn is_retryable_transport(message: &str) -> bool {
    message.contains("超时") || message.contains("连接失败") || message.contains("无法连接")
}

fn send_chat_completion_ping(
    client: &Client,
    input: &LlmProbeInput,
    timeout: Duration,
) -> LlmProbeConnectionResponse {
    let body = json!({
        "model": input.model,
        "max_tokens": 1,
        "temperature": 0,
        "stream": false,
        "messages": [{ "role": "user", "content": "ping" }]
    });
    let endpoint = input.chat_endpoint.to_string();
    let t0 = Instant::now();
    let resp = client
        .post(endpoint.clone())
        .bearer_auth(&input.api_key)
        .header("accept", "application/json")
        .timeout(timeout)
        .json(&body)
        .send();

    map_http_result(resp, t0, ProbeKind::Chat, &endpoint)
}

fn send_models_list(
    client: &Client,
    input: &LlmProbeInput,
    models_url: &Url,
    timeout: Duration,
) -> LlmProbeConnectionResponse {
    let endpoint = models_url.to_string();
    let t0 = Instant::now();
    let resp = client
        .get(endpoint.clone())
        .bearer_auth(&input.api_key)
        .header("accept", "application/json")
        .timeout(timeout)
        .send();

    map_http_result(resp, t0, ProbeKind::Models, &endpoint)
}

#[derive(Clone, Copy)]
enum ProbeKind {
    Chat,
    Models,
}

fn map_http_result(
    resp: Result<reqwest::blocking::Response, reqwest::Error>,
    t0: Instant,
    kind: ProbeKind,
    endpoint: &str,
) -> LlmProbeConnectionResponse {
    let latency_ms = Some(t0.elapsed().as_millis() as u64);
    match resp {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let _ = resp.text();
            if status >= 200 && status < 300 {
                let detail = match kind {
                    ProbeKind::Chat => "模型与 API Key 可用（与自动标点相同路径验证）。",
                    ProbeKind::Models => "API Key 可用（models 列表探测）。",
                };
                LlmProbeConnectionResponse {
                    ok: true,
                    status: Some(status),
                    message: detail.to_string(),
                    latency_ms,
                    probe_method: None,
                    endpoint: Some(endpoint.to_string()),
                }
            } else if matches!(status, 401 | 403) {
                LlmProbeConnectionResponse {
                    ok: false,
                    status: Some(status),
                    message: format!("认证失败（HTTP {status}），请检查 API Key。"),
                    latency_ms,
                    probe_method: None,
                    endpoint: Some(endpoint.to_string()),
                }
            } else if status == 400 || status == 422 {
                let hint = match kind {
                    ProbeKind::Chat => "请检查模型 ID 是否与厂商控制台一致。",
                    ProbeKind::Models => "服务地址可能不正确。",
                };
                LlmProbeConnectionResponse {
                    ok: false,
                    status: Some(status),
                    message: format!("请求被拒绝（HTTP {status}），{hint}"),
                    latency_ms,
                    probe_method: None,
                    endpoint: Some(endpoint.to_string()),
                }
            } else {
                LlmProbeConnectionResponse {
                    ok: false,
                    status: Some(status),
                    message: format!(
                        "连接失败（HTTP {status}），请检查 API 基址、模型 ID 或稍后重试。"
                    ),
                    latency_ms,
                    probe_method: None,
                    endpoint: Some(endpoint.to_string()),
                }
            }
        }
        Err(e) if e.is_timeout() => LlmProbeConnectionResponse {
            ok: false,
            status: None,
            message: format!("连接超时（{endpoint}），请检查网络、系统代理或 API 基址。"),
            latency_ms,
            probe_method: None,
            endpoint: Some(endpoint.to_string()),
        },
        Err(e) if e.is_connect() => LlmProbeConnectionResponse {
            ok: false,
            status: None,
            message: format!("无法连接到 {endpoint}：{e}"),
            latency_ms,
            probe_method: None,
            endpoint: Some(endpoint.to_string()),
        },
        Err(e) => LlmProbeConnectionResponse {
            ok: false,
            status: None,
            message: format!("连接 {endpoint} 失败：{e}"),
            latency_ms,
            probe_method: None,
            endpoint: Some(endpoint.to_string()),
        },
    }
}

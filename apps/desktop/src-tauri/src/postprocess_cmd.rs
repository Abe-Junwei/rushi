use crate::project::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::DbState;
use futures_util::future::{AbortHandle, Abortable};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;
use url::Url;

const KEYRING_SERVICE: &str = "studio.lingchuang.rushi.postprocess";
const DEFAULT_PROVIDER: &str = "openai-compatible";
const DEFAULT_TIMEOUT_SECS: u64 = 30;
const PROBE_TIMEOUT_SECS: u64 = 15;
const DEFAULT_API_KEY_ID: &str = "default";

/// 桌面 UI 传入的运行时配置（DeepSeek / Kimi 等）；优先于进程环境变量。
#[derive(Debug, Deserialize)]
pub struct PostprocessRuntimeBridge {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub api_key_id: Option<String>,
    #[serde(default)]
    pub allow_insecure_http: bool,
}

#[derive(Debug, Deserialize)]
pub struct PostprocessAutoPunctuateRequest {
    pub task: String,
    #[serde(default)]
    pub request_id: Option<String>,
    pub segment_uid: String,
    pub text: String,
    #[serde(default)]
    pub neighbor_snippets: Vec<String>,
    #[serde(default)]
    pub runtime: Option<PostprocessRuntimeBridge>,
}

#[derive(Debug, Serialize)]
pub struct PostprocessAutoPunctuateRawResponse {
    pub text: String,
    pub provider: String,
    pub latency_ms: u64,
}

#[derive(Default)]
pub struct PostprocessCancelState(pub Mutex<HashMap<String, AbortHandle>>);

#[derive(Debug, Deserialize)]
pub struct PostprocessCancelAutoPunctuateRequest {
    pub request_id: String,
}

#[derive(Debug, Deserialize)]
pub struct LlmSaveApiKeyRequest {
    #[serde(default)]
    pub api_key_id: Option<String>,
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
pub struct LlmDeleteApiKeyRequest {
    #[serde(default)]
    pub api_key_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LlmProbeConnectionRequest {
    pub runtime: PostprocessRuntimeBridge,
}

#[derive(Debug, Serialize)]
pub struct LlmProbeConnectionResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
}

#[derive(Debug)]
struct PostprocessConfig {
    provider: String,
    endpoint: Url,
    model: String,
    api_key: String,
}

#[tauri::command]
pub fn llm_save_api_key(req: LlmSaveApiKeyRequest) -> Result<String, String> {
    let api_key = req.api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 为空，无法写入系统钥匙串。".to_string());
    }
    let api_key_id = normalize_api_key_id(req.api_key_id.as_deref());
    let entry = Entry::new(KEYRING_SERVICE, &api_key_id)
        .map_err(|_| "无法创建 LLM 钥匙串条目，请检查系统钥匙串权限。".to_string())?;
    entry
        .set_password(api_key)
        .map_err(|_| "写入 LLM API Key 失败，请检查系统钥匙串权限。".to_string())?;
    Ok(api_key_id)
}

#[tauri::command]
pub fn llm_delete_api_key(req: LlmDeleteApiKeyRequest) -> Result<(), String> {
    let api_key_id = normalize_api_key_id(req.api_key_id.as_deref());
    let entry = Entry::new(KEYRING_SERVICE, &api_key_id)
        .map_err(|_| "无法定位 LLM 钥匙串条目，请检查系统钥匙串权限。".to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("删除 LLM API Key 失败，请检查系统钥匙串权限。".to_string()),
    }
}

#[tauri::command]
pub async fn llm_probe_connection(
    state: State<'_, DbState>,
    req: LlmProbeConnectionRequest,
) -> Result<LlmProbeConnectionResponse, String> {
    let config = resolve_runtime_postprocess_config(&req.runtime)?;
    let endpoint = build_postprocess_models_endpoint(&config.endpoint);
    append_desktop_log_line(
        &state,
        &format!(
            "INFO llm_probe provider={} endpoint={}",
            config.provider, endpoint
        ),
    );
    let out = probe_llm_connection(&config, Duration::from_secs(PROBE_TIMEOUT_SECS)).await;
    let level = if out.ok { "INFO" } else { "WARN" };
    let status = out
        .status
        .map(|x| x.to_string())
        .unwrap_or_else(|| "-".to_string());
    let latency_ms = out
        .latency_ms
        .map(|x| x.to_string())
        .unwrap_or_else(|| "-".to_string());
    append_desktop_log_line(
        &state,
        &format!(
            "{level} llm_probe_done provider={} status={} latency_ms={} message={}",
            config.provider, status, latency_ms, out.message
        ),
    );
    Ok(out)
}

#[tauri::command]
pub async fn postprocess_auto_punctuate(
    state: State<'_, DbState>,
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessAutoPunctuateRequest,
) -> Result<PostprocessAutoPunctuateRawResponse, String> {
    if req.task.trim() != "auto_punctuate" {
        return Err("暂不支持该后处理任务。".to_string());
    }
    if req.segment_uid.trim().is_empty() {
        return Err("缺少语段 uid，无法执行自动标点。".to_string());
    }
    let text = req.text.trim();
    if text.is_empty() {
        return Err("当前语段正文为空，无法执行自动标点。".to_string());
    }

    let config = resolve_postprocess_config(&req)?;
    let api_key = config.api_key.clone();
    let prompt = build_auto_punctuate_prompt(text, &req.neighbor_snippets);
    let body = json!({
        "model": config.model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "你是中文转写后处理助手。只给当前语段补充自然、克制的中文标点，不改写词语，不补充解释，不输出 markdown，不返回额外说明。"
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    });

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_auto_punctuate provider={} segment_uid={}",
            config.provider, req.segment_uid
        ),
    );

    let t0 = Instant::now();
    let request_id = req
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(str::to_string);
    let cancel_registration = request_id.as_ref().map(|id| {
        let (handle, registration) = AbortHandle::new_pair();
        if let Ok(mut handles) = cancel_state.0.lock() {
            if let Some(previous) = handles.insert(id.clone(), handle) {
                previous.abort();
            }
        }
        (id.clone(), registration)
    });

    let http_future = async {
        let resp = http_client()
            .post(config.endpoint.clone())
            .bearer_auth(api_key)
            .timeout(std::time::Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                append_desktop_log_line(&state, &format!("ERROR postprocess connect {e}"));
                "自动标点请求失败，请检查网络、模型配置或 API Key。".to_string()
            })?;

        let status = resp.status();
        let payload = resp.text().await.map_err(|e| {
            append_desktop_log_line(&state, &format!("ERROR postprocess read body {e}"));
            "自动标点返回体读取失败。".to_string()
        })?;
        Ok::<_, String>((status, payload))
    };

    let http_result = if let Some((id, registration)) = cancel_registration {
        let out = Abortable::new(http_future, registration).await;
        if let Ok(mut handles) = cancel_state.0.lock() {
            handles.remove(&id);
        }
        match out {
            Ok(result) => result,
            Err(_) => {
                append_desktop_log_line(
                    &state,
                    &format!("INFO postprocess_auto_punctuate_cancelled request_id={id}"),
                );
                return Err("自动标点请求已取消。".to_string());
            }
        }
    } else {
        http_future.await
    }?;

    let (status, payload) = http_result;

    if !status.is_success() {
        append_desktop_log_line(
            &state,
            &format!(
                "ERROR postprocess status={} body={}",
                status.as_u16(),
                payload
            ),
        );
        return Err(format!(
            "自动标点服务返回异常（HTTP {}），请检查 provider 配置或稍后重试。",
            status.as_u16()
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        append_desktop_log_line(&state, &format!("ERROR postprocess invalid json {e}"));
        "自动标点返回格式无法解析。".to_string()
    })?;
    let candidate = extract_chat_completion_text(&json)?;
    let latency_ms = t0.elapsed().as_millis() as u64;

    append_desktop_log_line(
        &state,
        &format!(
            "INFO postprocess_auto_punctuate_done provider={} latency_ms={latency_ms}",
            config.provider
        ),
    );

    Ok(PostprocessAutoPunctuateRawResponse {
        text: candidate,
        provider: config.provider,
        latency_ms,
    })
}

#[tauri::command]
pub fn postprocess_cancel_auto_punctuate(
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessCancelAutoPunctuateRequest,
) -> Result<bool, String> {
    let request_id = req.request_id.trim();
    if request_id.is_empty() {
        return Err("缺少自动标点请求 id。".to_string());
    }
    let handle = cancel_state
        .0
        .lock()
        .map_err(|_| "自动标点取消状态不可用。".to_string())?
        .remove(request_id);
    if let Some(handle) = handle {
        handle.abort();
        Ok(true)
    } else {
        Ok(false)
    }
}

fn resolve_postprocess_config(
    req: &PostprocessAutoPunctuateRequest,
) -> Result<PostprocessConfig, String> {
    if let Some(rt) = req.runtime.as_ref() {
        return resolve_runtime_postprocess_config(rt);
    }
    load_postprocess_config_from_env()
}

fn resolve_runtime_postprocess_config(
    rt: &PostprocessRuntimeBridge,
) -> Result<PostprocessConfig, String> {
    let base_url = rt.base_url.trim();
    let model = rt.model.trim();
    let api_key = rt.api_key.trim();
    if base_url.is_empty() {
        return Err("未配置自动标点服务地址。".to_string());
    }
    if model.is_empty() {
        return Err("未配置自动标点模型。".to_string());
    }
    let endpoint = parse_postprocess_endpoint(base_url, rt.allow_insecure_http)?;
    let provider = if rt.provider.trim().is_empty() {
        DEFAULT_PROVIDER.to_string()
    } else {
        rt.provider.trim().to_string()
    };
    let api_key = if !api_key.is_empty() {
        api_key.to_string()
    } else {
        load_postprocess_api_key(rt.api_key_id.as_deref())?
    };
    Ok(PostprocessConfig {
        provider,
        endpoint,
        model: model.to_string(),
        api_key,
    })
}

fn load_postprocess_config_from_env() -> Result<PostprocessConfig, String> {
    let provider =
        env::var("RUSHI_POSTPROCESS_PROVIDER").unwrap_or_else(|_| DEFAULT_PROVIDER.to_string());
    let base_url = env::var("RUSHI_POSTPROCESS_BASE_URL").map_err(|_| {
        "未配置 LLM：请在「设置 → LLM 配置」填写连接信息，或设置 RUSHI_POSTPROCESS_BASE_URL。"
            .to_string()
    })?;
    let model = env::var("RUSHI_POSTPROCESS_MODEL")
        .map_err(|_| "未配置自动标点模型：请设置 RUSHI_POSTPROCESS_MODEL。".to_string())?;
    let api_key_id = env::var("RUSHI_POSTPROCESS_API_KEY_ID")
        .ok()
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty());
    let allow_insecure_http = env::var("RUSHI_POSTPROCESS_ALLOW_INSECURE_HTTP")
        .ok()
        .is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"));
    let endpoint = parse_postprocess_endpoint(&base_url, allow_insecure_http)?;
    let api_key = load_postprocess_api_key(api_key_id.as_deref())?;
    Ok(PostprocessConfig {
        provider,
        endpoint,
        model,
        api_key,
    })
}

fn parse_postprocess_endpoint(raw: &str, allow_insecure_http: bool) -> Result<Url, String> {
    let mut url = Url::parse(raw.trim())
        .map_err(|_| "自动标点服务地址无效，请检查 API 基址。".to_string())?;
    match url.scheme() {
        "https" => {}
        "http" if allow_insecure_http && is_loopback_host(url.host_str()) => {}
        _ => {
            return Err("自动标点服务地址必须为 HTTPS；本地开发仅允许 loopback HTTP。".to_string())
        }
    }

    let path = url.path().trim_end_matches('/');
    if path.is_empty() || path == "/" {
        url.set_path("/v1/chat/completions");
    } else if !path.ends_with("/chat/completions") {
        url.set_path(&format!("{path}/chat/completions"));
    }
    Ok(url)
}

fn build_postprocess_models_endpoint(chat_endpoint: &Url) -> Url {
    let mut url = chat_endpoint.clone();
    let path = url.path().trim_end_matches('/');
    let next = if path.is_empty() || path == "/" {
        "/v1/models".to_string()
    } else if let Some(prefix) = path.strip_suffix("/chat/completions") {
        let prefix = prefix.trim_end_matches('/');
        if prefix.is_empty() {
            "/v1/models".to_string()
        } else {
            format!("{prefix}/models")
        }
    } else if path.ends_with("/models") {
        path.to_string()
    } else {
        format!("{path}/models")
    };
    url.set_path(&next);
    url
}

fn is_loopback_host(host: Option<&str>) -> bool {
    matches!(host, Some("127.0.0.1" | "localhost" | "::1"))
}

fn normalize_api_key_id(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|x| !x.is_empty())
        .unwrap_or(DEFAULT_API_KEY_ID)
        .to_string()
}

fn load_postprocess_api_key(api_key_id: Option<&str>) -> Result<String, String> {
    if let Some(id) = api_key_id {
        let entry = Entry::new(KEYRING_SERVICE, id)
            .map_err(|_| "自动标点密钥配置无效：无法读取 keychain 条目。".to_string())?;
        match entry.get_password() {
            Ok(key) => {
                let trimmed = key.trim();
                if !trimmed.is_empty() {
                    return Ok(trimmed.to_string());
                }
            }
            Err(keyring::Error::NoEntry) => {}
            Err(_) => return Err("自动标点密钥配置无效：无法读取 keychain 条目。".to_string()),
        }
    }

    let fallback = env::var("RUSHI_POSTPROCESS_API_KEY")
        .ok()
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty());
    fallback.ok_or_else(|| {
        "未配置自动标点 API Key：请设置 RUSHI_POSTPROCESS_API_KEY_ID（keychain）或开发环境变量 RUSHI_POSTPROCESS_API_KEY。".to_string()
    })
}

async fn probe_llm_connection(
    config: &PostprocessConfig,
    timeout: Duration,
) -> LlmProbeConnectionResponse {
    let endpoint = build_postprocess_models_endpoint(&config.endpoint);
    let t0 = Instant::now();
    match http_client()
        .get(endpoint)
        .bearer_auth(&config.api_key)
        .timeout(timeout)
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let latency_ms = Some(t0.elapsed().as_millis() as u64);
            if resp.status().is_success() {
                LlmProbeConnectionResponse {
                    ok: true,
                    status: Some(status),
                    message: "连接成功。".to_string(),
                    latency_ms,
                }
            } else if matches!(status, 401 | 403) {
                LlmProbeConnectionResponse {
                    ok: false,
                    status: Some(status),
                    message: format!("认证失败（HTTP {status}），请检查 API Key。"),
                    latency_ms,
                }
            } else {
                LlmProbeConnectionResponse {
                    ok: false,
                    status: Some(status),
                    message: format!("连接失败（HTTP {status}），请检查服务地址或稍后重试。"),
                    latency_ms,
                }
            }
        }
        Err(e) if e.is_timeout() => LlmProbeConnectionResponse {
            ok: false,
            status: None,
            message: "连接超时，请检查网络或稍后重试。".to_string(),
            latency_ms: Some(t0.elapsed().as_millis() as u64),
        },
        Err(_) => LlmProbeConnectionResponse {
            ok: false,
            status: None,
            message: "连接失败，请检查网络、服务地址或 API Key。".to_string(),
            latency_ms: Some(t0.elapsed().as_millis() as u64),
        },
    }
}

fn build_auto_punctuate_prompt(text: &str, neighbors: &[String]) -> String {
    let mut lines = vec![
        "任务：仅为“当前语段”补充自然中文标点。".to_string(),
        "约束：".to_string(),
        "1. 不改写词语，不补充省略内容。".to_string(),
        "2. 不输出解释，不加引号标题。".to_string(),
        "3. 仅返回处理后的当前语段正文。".to_string(),
    ];
    if !neighbors.is_empty() {
        lines.push("上下文（仅辅助判断停顿，不可合并进结果）：".to_string());
        for (idx, snippet) in neighbors.iter().enumerate() {
            if snippet.trim().is_empty() {
                continue;
            }
            lines.push(format!("片段{}：{}", idx + 1, snippet.trim()));
        }
    }
    lines.push("当前语段：".to_string());
    lines.push(text.to_string());
    lines.join("\n")
}

fn extract_chat_completion_text(v: &serde_json::Value) -> Result<String, String> {
    let Some(choice) = v.get("choices").and_then(|x| x.get(0)) else {
        return Err("自动标点返回缺少 choices。".to_string());
    };
    let Some(content) = choice.get("message").and_then(|x| x.get("content")) else {
        return Err("自动标点返回缺少 message.content。".to_string());
    };
    let out = if let Some(text) = content.as_str() {
        text.trim().to_string()
    } else if let Some(parts) = content.as_array() {
        parts
            .iter()
            .filter_map(|p| p.get("text").and_then(|x| x.as_str()))
            .collect::<Vec<_>>()
            .join("")
            .trim()
            .to_string()
    } else {
        String::new()
    };
    if out.is_empty() {
        return Err("自动标点返回内容为空。".to_string());
    }
    Ok(out)
}

#[cfg(test)]
#[path = "postprocess_cmd_tests.rs"]
mod tests;

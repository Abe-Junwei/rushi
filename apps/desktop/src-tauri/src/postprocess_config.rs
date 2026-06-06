use super::postprocess_secret_store::read_llm_secret;
use super::{NeighborContextItem, PostprocessAutoPunctuateRequest, PostprocessRuntimeBridge};
use std::env;
use std::path::Path;
use url::Url;

pub(crate) const DEFAULT_PROVIDER: &str = "openai-compatible";
pub(crate) const DEFAULT_TIMEOUT_SECS: u64 = 30;
pub(crate) const DEFAULT_API_KEY_ID: &str = "default";
/// Ollama 等 loopback 服务忽略 Bearer；占位以满足 HTTP 客户端。
pub(crate) const LOOPBACK_PLACEHOLDER_API_KEY: &str = "ollama";

#[derive(Debug)]
pub(crate) struct PostprocessConfig {
    pub provider: String,
    pub endpoint: Url,
    pub model: String,
    pub api_key: String,
}

pub(crate) fn resolve_postprocess_config(
    req: &PostprocessAutoPunctuateRequest,
    app_data_root: &Path,
) -> Result<PostprocessConfig, String> {
    if let Some(rt) = req.runtime.as_ref() {
        return resolve_runtime_postprocess_config(rt, app_data_root);
    }
    load_postprocess_config_from_env(app_data_root)
}

pub(crate) async fn resolve_postprocess_config_async(
    req: &PostprocessAutoPunctuateRequest,
    app_data_root: &Path,
) -> Result<PostprocessConfig, String> {
    let req = req.clone();
    let app_data_root = app_data_root.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || resolve_postprocess_config(&req, &app_data_root))
        .await
        .map_err(|e| format!("无法解析 LLM 配置：{}", e))?
}

pub(crate) fn resolve_runtime_postprocess_config(
    rt: &PostprocessRuntimeBridge,
    app_data_root: &Path,
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
    let parsed_base =
        Url::parse(base_url).map_err(|_| "自动标点服务地址无效，请检查 API 基址。".to_string())?;
    let api_key = if !api_key.is_empty() {
        api_key.to_string()
    } else if rt.allow_insecure_http && is_loopback_host(parsed_base.host_str()) {
        LOOPBACK_PLACEHOLDER_API_KEY.to_string()
    } else {
        load_postprocess_api_key(app_data_root, rt.api_key_id.as_deref())?
    };
    Ok(PostprocessConfig {
        provider,
        endpoint,
        model: model.to_string(),
        api_key,
    })
}

fn load_postprocess_config_from_env(app_data_root: &Path) -> Result<PostprocessConfig, String> {
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
    let api_key = load_postprocess_api_key(app_data_root, api_key_id.as_deref())?;
    Ok(PostprocessConfig {
        provider,
        endpoint,
        model,
        api_key,
    })
}

pub(crate) fn parse_postprocess_endpoint(
    raw: &str,
    allow_insecure_http: bool,
) -> Result<Url, String> {
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

pub(crate) fn build_postprocess_models_endpoint(chat_endpoint: &Url) -> Url {
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

pub(crate) fn is_valid_secret_account_id(id: &str) -> bool {
    let id = id.trim();
    if id.is_empty() || id.len() > 48 {
        return false;
    }
    if id.starts_with("sk-") || id.starts_with("Bearer ") {
        return false;
    }
    id.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub(crate) fn normalize_api_key_id(raw: Option<&str>) -> String {
    raw.map(str::trim)
        .filter(|x| !x.is_empty())
        .filter(|x| is_valid_secret_account_id(x))
        .unwrap_or(DEFAULT_API_KEY_ID)
        .to_string()
}

fn load_postprocess_api_key(
    app_data_root: &Path,
    api_key_id: Option<&str>,
) -> Result<String, String> {
    let id = normalize_api_key_id(api_key_id);
    if let Some(key) = read_llm_secret(app_data_root, &id)? {
        return Ok(key);
    }

    let fallback = env::var("RUSHI_POSTPROCESS_API_KEY")
        .ok()
        .map(|x| x.trim().to_string())
        .filter(|x| !x.is_empty());
    if let Some(key) = fallback {
        return Ok(key);
    }

    Err(format!(
        "本地未找到 API Key（标识：{id}）。请在「设置 → LLM 配置」重新填写并保存。"
    ))
}

pub(crate) fn build_auto_punctuate_prompt(
    text: &str,
    neighbor_context: &[NeighborContextItem],
    legacy_snippets: &[String],
) -> String {
    let mut lines = vec![
        "任务：仅为“当前语段”补充自然中文标点。".to_string(),
        "约束：".to_string(),
        "1. 不改写词语，不补充省略内容。".to_string(),
        "2. 不输出解释，不加引号标题。".to_string(),
        "3. 仅返回处理后的当前语段正文。".to_string(),
    ];
    let context_lines = if !neighbor_context.is_empty() {
        neighbor_context
            .iter()
            .filter_map(|item| {
                let snippet = item.text.trim();
                if snippet.is_empty() {
                    return None;
                }
                let label = match item.role.trim() {
                    "prev" => "上一语段",
                    "next" => "下一语段",
                    other if !other.is_empty() => other,
                    _ => "上下文",
                };
                Some(format!("{label}：{snippet}"))
            })
            .collect::<Vec<_>>()
    } else {
        legacy_snippets
            .iter()
            .enumerate()
            .filter_map(|(idx, snippet)| {
                let trimmed = snippet.trim();
                if trimmed.is_empty() {
                    return None;
                }
                Some(format!("片段{}：{trimmed}", idx + 1))
            })
            .collect::<Vec<_>>()
    };
    if !context_lines.is_empty() {
        lines.push("上下文（仅辅助判断停顿，不可合并进结果）：".to_string());
        lines.extend(context_lines);
    }
    lines.push("当前语段：".to_string());
    lines.push(text.to_string());
    lines.join("\n")
}

pub(crate) fn extract_chat_completion_text(v: &serde_json::Value) -> Result<String, String> {
    extract_chat_completion_text_labeled(v, "自动标点")
}

pub(crate) fn extract_chat_completion_text_labeled(
    v: &serde_json::Value,
    task_label: &str,
) -> Result<String, String> {
    let Some(choice) = v.get("choices").and_then(|x| x.get(0)) else {
        return Err(format!("{task_label}返回缺少 choices。"));
    };
    let Some(content) = choice.get("message").and_then(|x| x.get("content")) else {
        return Err(format!("{task_label}返回缺少 message.content。"));
    };
    let out = if let Some(text) = content.as_str() {
        text.trim().to_string()
    } else if let Some(parts) = content.as_array() {
        if parts
            .iter()
            .all(|p| p.get("type").is_some() || p.get("text").is_some())
        {
            parts
                .iter()
                .filter_map(|p| p.get("text").and_then(|x| x.as_str()))
                .collect::<Vec<_>>()
                .join("")
                .trim()
                .to_string()
        } else {
            serde_json::to_string(content).unwrap_or_default()
        }
    } else if content.is_object() {
        serde_json::to_string(content).unwrap_or_default()
    } else {
        String::new()
    };
    if out.is_empty() {
        return Err(format!("{task_label}返回内容为空。"));
    }
    Ok(out)
}

pub(crate) fn chat_completion_finish_reason(v: &serde_json::Value) -> Option<&str> {
    v.get("choices")?.get(0)?.get("finish_reason")?.as_str()
}

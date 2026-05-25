use crate::project::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::DbState;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::time::Instant;
use tauri::State;
use url::Url;

const KEYRING_SERVICE: &str = "studio.lingchuang.rushi.postprocess";
const DEFAULT_PROVIDER: &str = "openai-compatible";
const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// 桌面 UI 传入的运行时配置（DeepSeek / Kimi 等）；优先于进程环境变量。
#[derive(Debug, Deserialize)]
pub struct PostprocessRuntimeBridge {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub api_key: String,
    #[serde(default)]
    pub allow_insecure_http: bool,
}

#[derive(Debug, Deserialize)]
pub struct PostprocessAutoPunctuateRequest {
    pub task: String,
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

#[derive(Debug)]
struct PostprocessConfig {
    provider: String,
    endpoint: Url,
    model: String,
    api_key: String,
}

#[tauri::command]
pub async fn postprocess_auto_punctuate(
    state: State<'_, DbState>,
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

    if !status.is_success() {
        append_desktop_log_line(
            &state,
            &format!("ERROR postprocess status={} body={}", status.as_u16(), payload),
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

fn resolve_postprocess_config(req: &PostprocessAutoPunctuateRequest) -> Result<PostprocessConfig, String> {
    if let Some(rt) = req.runtime.as_ref() {
        let base_url = rt.base_url.trim();
        let model = rt.model.trim();
        let api_key = rt.api_key.trim();
        if base_url.is_empty() {
            return Err("未配置自动标点服务地址。".to_string());
        }
        if model.is_empty() {
            return Err("未配置自动标点模型。".to_string());
        }
        if api_key.is_empty() {
            return Err("未配置自动标点 API Key。".to_string());
        }
        let endpoint = parse_postprocess_endpoint(base_url, rt.allow_insecure_http)?;
        let provider = if rt.provider.trim().is_empty() {
            DEFAULT_PROVIDER.to_string()
        } else {
            rt.provider.trim().to_string()
        };
        return Ok(PostprocessConfig {
            provider,
            endpoint,
            model: model.to_string(),
            api_key: api_key.to_string(),
        });
    }
    load_postprocess_config_from_env()
}

fn load_postprocess_config_from_env() -> Result<PostprocessConfig, String> {
    let provider = env::var("RUSHI_POSTPROCESS_PROVIDER").unwrap_or_else(|_| DEFAULT_PROVIDER.to_string());
    let base_url = env::var("RUSHI_POSTPROCESS_BASE_URL").map_err(|_| {
        "未配置 LLM：请在「设置 → LLM 配置」填写连接信息，或设置 RUSHI_POSTPROCESS_BASE_URL。".to_string()
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
    let mut url =
        Url::parse(raw.trim()).map_err(|_| "自动标点服务地址无效，请检查 RUSHI_POSTPROCESS_BASE_URL。".to_string())?;
    match url.scheme() {
        "https" => {}
        "http" if allow_insecure_http && is_loopback_host(url.host_str()) => {}
        _ => return Err("自动标点服务地址必须为 HTTPS；本地开发仅允许 loopback HTTP。".to_string()),
    }

    let path = url.path().trim_end_matches('/');
    if path.is_empty() || path == "/" {
        url.set_path("/v1/chat/completions");
    } else if !path.ends_with("/chat/completions") {
        url.set_path(&format!("{path}/chat/completions"));
    }
    Ok(url)
}

fn is_loopback_host(host: Option<&str>) -> bool {
    matches!(host, Some("127.0.0.1" | "localhost" | "::1"))
}

fn load_postprocess_api_key(api_key_id: Option<&str>) -> Result<String, String> {
    if let Some(id) = api_key_id {
        let entry = Entry::new(KEYRING_SERVICE, id)
            .map_err(|_| "自动标点密钥配置无效：无法读取 keychain 条目。".to_string())?;
        let key = entry
            .get_password()
            .map_err(|_| "未找到自动标点 API Key：请先把密钥写入 keychain。".to_string())?;
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
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
mod tests {
    use super::{
        build_auto_punctuate_prompt, extract_chat_completion_text, parse_postprocess_endpoint,
        resolve_postprocess_config, PostprocessAutoPunctuateRequest, PostprocessRuntimeBridge,
    };
    use serde_json::json;

    #[test]
    fn parse_endpoint_appends_chat_path() {
        let url = parse_postprocess_endpoint("https://api.openai.com/v1", false).unwrap();
        assert_eq!(url.as_str(), "https://api.openai.com/v1/chat/completions");
    }

    #[test]
    fn parse_endpoint_rejects_non_https() {
        let err = parse_postprocess_endpoint("http://example.com/v1", false).unwrap_err();
        assert!(err.contains("HTTPS"));
    }

    #[test]
    fn extract_text_from_string_content() {
        let payload = json!({
            "choices": [{ "message": { "content": "你好，世界。" } }]
        });
        let text = extract_chat_completion_text(&payload).unwrap();
        assert_eq!(text, "你好，世界。");
    }

    #[test]
    fn extract_text_from_array_content() {
        let payload = json!({
            "choices": [{
                "message": {
                    "content": [
                        { "type": "text", "text": "你好" },
                        { "type": "text", "text": "，世界。" }
                    ]
                }
            }]
        });
        let text = extract_chat_completion_text(&payload).unwrap();
        assert_eq!(text, "你好，世界。");
    }

    #[test]
    fn prompt_includes_neighbors() {
        let prompt = build_auto_punctuate_prompt("今天天气不错我们出发吧", &["上一句".into(), "下一句".into()]);
        assert!(prompt.contains("片段1：上一句"));
        assert!(prompt.contains("当前语段："));
    }

    #[test]
    fn runtime_bridge_resolves_deepseek_endpoint() {
        let req = PostprocessAutoPunctuateRequest {
            task: "auto_punctuate".into(),
            segment_uid: "u1".into(),
            text: "你好".into(),
            neighbor_snippets: vec![],
            runtime: Some(PostprocessRuntimeBridge {
                provider: "DeepSeek".into(),
                base_url: "https://api.deepseek.com/v1".into(),
                model: "deepseek-chat".into(),
                api_key: "sk-x".into(),
                allow_insecure_http: false,
            }),
        };
        let cfg = resolve_postprocess_config(&req).unwrap();
        assert_eq!(cfg.endpoint.as_str(), "https://api.deepseek.com/v1/chat/completions");
        assert_eq!(cfg.model, "deepseek-chat");
    }
}

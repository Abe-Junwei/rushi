//! Ollama loopback 检测（LLM-LOC-4a）；仅 GET /api/tags，不拉模型。

use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaDetectResponse {
    pub reachable: bool,
    pub model_count: u32,
    pub has_qwen25_7b: bool,
    pub message: String,
}

const DEFAULT_TAGS_URL: &str = "http://127.0.0.1:11434/api/tags";
const DETECT_TIMEOUT: Duration = Duration::from_secs(4);

pub fn detect_ollama_tags(tags_url: Option<&str>) -> OllamaDetectResponse {
    let url = tags_url
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_TAGS_URL);
    let client = match reqwest::blocking::Client::builder()
        .connect_timeout(DETECT_TIMEOUT)
        .timeout(DETECT_TIMEOUT)
        .no_proxy()
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return OllamaDetectResponse {
                reachable: false,
                model_count: 0,
                has_qwen25_7b: false,
                message: format!("无法创建 HTTP 客户端：{e}"),
            };
        }
    };
    let resp = match client.get(url).send() {
        Ok(r) => r,
        Err(e) => {
            return OllamaDetectResponse {
                reachable: false,
                model_count: 0,
                has_qwen25_7b: false,
                message: format!(
                    "未检测到 Ollama 服务（{url}）。请安装并启动 Ollama，或执行 ollama serve。详情：{e}",
                    url = url,
                    e = e
                ),
            };
        }
    };
    if !resp.status().is_success() {
        return OllamaDetectResponse {
            reachable: false,
            model_count: 0,
            has_qwen25_7b: false,
            message: format!("Ollama 返回 HTTP {}。", resp.status().as_u16()),
        };
    }
    let body = match resp.text() {
        Ok(b) => b,
        Err(e) => {
            return OllamaDetectResponse {
                reachable: false,
                model_count: 0,
                has_qwen25_7b: false,
                message: format!("读取 Ollama 响应失败：{e}"),
            };
        }
    };
    let v: serde_json::Value = match serde_json::from_str(&body) {
        Ok(x) => x,
        Err(_) => {
            return OllamaDetectResponse {
                reachable: true,
                model_count: 0,
                has_qwen25_7b: false,
                message: "Ollama 已响应，但模型列表解析失败。".to_string(),
            };
        }
    };
    let names: Vec<String> = v
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.get("name").and_then(|n| n.as_str()))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    let count = names.len() as u32;
    let has_qwen = names.iter().any(|n| n.starts_with("qwen2.5:7b") || n == "qwen2.5:7b");
    let message = if count == 0 {
        "Ollama 已运行，尚未 pull 模型。建议：ollama pull qwen2.5:7b".to_string()
    } else if has_qwen {
        format!("Ollama 就绪，已安装 {count} 个模型（含 qwen2.5:7b）。")
    } else {
        format!("Ollama 就绪（{count} 个模型）。当前未检测到 qwen2.5:7b，请在模型 ID 中填写已 pull 的模型名。")
    };
    OllamaDetectResponse {
        reachable: true,
        model_count: count,
        has_qwen25_7b: has_qwen,
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_unreachable_host() {
        let out = detect_ollama_tags(Some("http://127.0.0.1:1/api/tags"));
        assert!(!out.reachable);
    }
}

//! Ollama loopback 检测（LLM-LOC-4a）；仅 GET /api/tags，不拉模型。

use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaDetectResponse {
    pub reachable: bool,
    pub model_count: u32,
    pub has_qwen25_7b: bool,
    /// 当请求携带 `model` 时：该模型是否在 `/api/tags` 列表中。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_configured_model: Option<bool>,
    pub message: String,
}

fn ollama_model_installed(names: &[String], model: &str) -> bool {
    let m = model.trim();
    if m.is_empty() {
        return false;
    }
    names.iter().any(|n| {
        n == m
            || n.starts_with(&format!("{m}:"))
            || m.starts_with(&format!("{n}:"))
            || (n.contains(':') && n.split(':').next() == Some(m))
    })
}

fn has_qwen25_7b_tag(names: &[String]) -> bool {
    names
        .iter()
        .any(|n| n.starts_with("qwen2.5:7b") || n == "qwen2.5:7b")
}

const DEFAULT_TAGS_URL: &str = "http://127.0.0.1:11434/api/tags";
const DETECT_TIMEOUT: Duration = Duration::from_secs(4);

pub fn detect_ollama_tags(tags_url: Option<&str>, configured_model: Option<&str>) -> OllamaDetectResponse {
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
                has_configured_model: None,
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
                has_configured_model: None,
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
            has_configured_model: None,
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
                has_configured_model: None,
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
                has_configured_model: configured_model.map(|_| false),
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
    let has_qwen = has_qwen25_7b_tag(&names);
    let model_id = configured_model.map(str::trim).filter(|s| !s.is_empty());
    let configured = model_id.map(|m| ollama_model_installed(&names, m));
    let message = if count == 0 {
        "Ollama 已运行，尚未 pull 模型。建议：ollama pull qwen2.5:7b".to_string()
    } else if let Some(true) = configured {
        format!(
            "Ollama 就绪，已安装 {count} 个模型（含当前模型 {}）。",
            model_id.unwrap_or("")
        )
    } else if let Some(false) = configured {
        format!(
            "Ollama 已运行（{count} 个模型），但未找到模型「{}」。请 ollama pull 或修改模型 ID。",
            model_id.unwrap_or("")
        )
    } else if has_qwen {
        format!("Ollama 就绪，已安装 {count} 个模型（含 qwen2.5:7b）。")
    } else {
        format!("Ollama 就绪（{count} 个模型）。建议 pull qwen2.5:7b 或填写已安装的模型 ID。")
    };
    OllamaDetectResponse {
        reachable: true,
        model_count: count,
        has_qwen25_7b: has_qwen,
        has_configured_model: configured,
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_unreachable_host() {
        let out = detect_ollama_tags(Some("http://127.0.0.1:1/api/tags"), None);
        assert!(!out.reachable);
    }

    #[test]
    fn ollama_model_installed_matches_tags() {
        let names = vec![
            "qwen2.5:7b".to_string(),
            "llama3.2:latest".to_string(),
        ];
        assert!(ollama_model_installed(&names, "qwen2.5:7b"));
        assert!(ollama_model_installed(&names, "llama3.2"));
        assert!(!ollama_model_installed(&names, "missing:7b"));
    }
}

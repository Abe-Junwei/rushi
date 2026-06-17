use super::postprocess_probe::probe_llm_connection_blocking;
use super::{
    build_auto_punctuate_prompt, build_postprocess_models_endpoint, extract_chat_completion_text,
    normalize_api_key_id, parse_postprocess_endpoint, resolve_postprocess_config,
    secret_account_for_delete, LlmProbeConnectionResponse, PostprocessAutoPunctuateRequest,
    PostprocessConfig, PostprocessRuntimeBridge,
};
use serde_json::json;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::Path;
use std::thread;
use std::time::Duration;
use url::Url;

fn run_probe(config: &PostprocessConfig, timeout: Duration) -> LlmProbeConnectionResponse {
    probe_llm_connection_blocking(config, timeout)
}

fn spawn_http_server(status_line: &str, body: &str, delay: Duration) -> Url {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let status_line = status_line.to_string();
    let body = body.to_string();
    thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut buf = [0u8; 4096];
        let n = stream.read(&mut buf).unwrap_or(0);
        let req = String::from_utf8_lossy(&buf[..n]);
        let response_body = if req.starts_with("POST ") {
            r#"{"choices":[{"message":{"content":"."}}]}"#.to_string()
        } else {
            body.clone()
        };
        if !delay.is_zero() {
            thread::sleep(delay);
        }
        let response = format!(
            "HTTP/1.1 {status_line}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{response_body}",
            response_body.len()
        );
        let _ = stream.write_all(response.as_bytes());
    });
    Url::parse(&format!(
        "http://127.0.0.1:{}/v1/chat/completions",
        addr.port()
    ))
    .unwrap()
}

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
fn models_endpoint_uses_same_v1_prefix() {
    let chat = parse_postprocess_endpoint("https://api.openai.com/v1", false).unwrap();
    let models = build_postprocess_models_endpoint(&chat);
    assert_eq!(models.as_str(), "https://api.openai.com/v1/models");
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
fn extract_text_from_json_object_content() {
    let payload = json!({
        "choices": [{
            "message": {
                "content": {
                    "lines": ["甲", "乙。"],
                    "break_after_line": [0]
                }
            }
        }]
    });
    let text = extract_chat_completion_text(&payload).unwrap();
    assert!(text.contains("\"lines\""));
    assert!(text.contains("甲"));
}

#[test]
fn extract_text_from_json_string_array_content() {
    let payload = json!({
        "choices": [{
            "message": {
                "content": ["行一", "行二"]
            }
        }]
    });
    let text = extract_chat_completion_text(&payload).unwrap();
    assert!(text.contains("行一"));
}

#[test]
fn auto_punctuate_prompt_accepts_custom_instructions() {
    let custom = "自定义标点任务";
    let prompt = build_auto_punctuate_prompt("你好世界", &[], &[], Some(custom));
    assert!(prompt.starts_with(custom));
    assert!(prompt.contains("当前语段："));
}

#[test]
fn prompt_includes_labeled_neighbor_context() {
    let prompt = build_auto_punctuate_prompt(
        "今天天气不错我们出发吧",
        &[
            super::NeighborContextItem {
                role: "prev".into(),
                text: "上一句".into(),
            },
            super::NeighborContextItem {
                role: "next".into(),
                text: "下一句".into(),
            },
        ],
        &[],
        None,
    );
    assert!(prompt.contains("上一语段：上一句"));
    assert!(prompt.contains("下一语段：下一句"));
    assert!(prompt.contains("当前语段："));
}

#[test]
fn prompt_falls_back_to_legacy_snippets() {
    let prompt = build_auto_punctuate_prompt("今天天气不错我们出发吧", &[], &["上一句".into()], None);
    assert!(prompt.contains("片段1：上一句"));
}

#[test]
fn runtime_bridge_deserializes_snake_case_json_from_ui() {
    let raw = json!({
        "provider": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "api_key": "sk-from-ui"
    });
    let req = PostprocessAutoPunctuateRequest {
        task: "auto_punctuate".into(),
        request_id: None,
        segment_uid: "u1".into(),
        text: "你好".into(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: Some(serde_json::from_value(raw).unwrap()),
    };
    let cfg = resolve_postprocess_config(&req, Path::new("/tmp/rushi-test-unused")).unwrap();
    assert_eq!(cfg.api_key, "sk-from-ui");
    assert_eq!(
        cfg.endpoint.as_str(),
        "https://api.deepseek.com/v1/chat/completions"
    );
}

#[test]
fn runtime_bridge_resolves_deepseek_endpoint() {
    let req = PostprocessAutoPunctuateRequest {
        task: "auto_punctuate".into(),
        request_id: None,
        segment_uid: "u1".into(),
        text: "你好".into(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: Some(PostprocessRuntimeBridge {
            provider: "DeepSeek".into(),
            base_url: "https://api.deepseek.com/v1".into(),
            model: "deepseek-chat".into(),
            api_key: "sk-x".into(),
            api_key_id: None,
            allow_insecure_http: false,
            prompt_overrides: None,
        }),
    };
    let cfg = resolve_postprocess_config(&req, Path::new("/tmp/rushi-test-unused")).unwrap();
    assert_eq!(
        cfg.endpoint.as_str(),
        "https://api.deepseek.com/v1/chat/completions"
    );
    assert_eq!(cfg.model, "deepseek-chat");
}

#[test]
fn runtime_bridge_prefers_inline_api_key() {
    let req = PostprocessAutoPunctuateRequest {
        task: "auto_punctuate".into(),
        request_id: None,
        segment_uid: "u1".into(),
        text: "你好".into(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: Some(PostprocessRuntimeBridge {
            provider: "DeepSeek".into(),
            base_url: "https://api.deepseek.com/v1".into(),
            model: "deepseek-chat".into(),
            api_key: "sk-inline".into(),
            api_key_id: Some("default".into()),
            allow_insecure_http: false,
            prompt_overrides: None,
        }),
    };
    let cfg = resolve_postprocess_config(&req, Path::new("/tmp/rushi-test-unused")).unwrap();
    assert_eq!(cfg.api_key, "sk-inline");
}

#[test]
fn runtime_bridge_loopback_uses_placeholder_key_without_secret() {
    let req = PostprocessAutoPunctuateRequest {
        task: "auto_punctuate".into(),
        request_id: None,
        segment_uid: "u1".into(),
        text: "你好".into(),
        neighbor_snippets: vec![],
        neighbor_context: vec![],
        runtime: Some(PostprocessRuntimeBridge {
            provider: "Ollama".into(),
            base_url: "http://127.0.0.1:11434/v1".into(),
            model: "qwen2.5:7b".into(),
            api_key: String::new(),
            api_key_id: None,
            allow_insecure_http: true,
            prompt_overrides: None,
        }),
    };
    let cfg = resolve_postprocess_config(&req, Path::new("/tmp/rushi-test-unused")).unwrap();
    assert_eq!(cfg.api_key, "ollama");
    assert_eq!(
        cfg.endpoint.as_str(),
        "http://127.0.0.1:11434/v1/chat/completions"
    );
}

#[test]
fn probe_reports_success() {
    let endpoint = spawn_http_server("200 OK", r#"{"data":[]}"#, Duration::from_millis(0));
    let cfg = PostprocessConfig {
        provider: "DeepSeek".into(),
        endpoint,
        model: "deepseek-chat".into(),
        api_key: "sk-x".into(),
    };
    let out = run_probe(&cfg, Duration::from_millis(200));
    assert!(out.ok);
    assert_eq!(out.status, Some(200));
}

#[test]
fn probe_reports_auth_failure() {
    let endpoint = spawn_http_server(
        "401 Unauthorized",
        r#"{"error":"bad key"}"#,
        Duration::from_millis(0),
    );
    let cfg = PostprocessConfig {
        provider: "DeepSeek".into(),
        endpoint,
        model: "deepseek-chat".into(),
        api_key: "sk-x".into(),
    };
    let out = run_probe(&cfg, Duration::from_millis(200));
    assert!(!out.ok);
    assert_eq!(out.status, Some(401));
    assert!(out.message.contains("认证失败"));
}

#[test]
fn probe_reports_timeout() {
    let endpoint = spawn_http_server("200 OK", r#"{"data":[]}"#, Duration::from_millis(120));
    let cfg = PostprocessConfig {
        provider: "DeepSeek".into(),
        endpoint,
        model: "deepseek-chat".into(),
        api_key: "sk-x".into(),
    };
    let out = run_probe(&cfg, Duration::from_millis(30));
    assert!(!out.ok);
    assert!(out.message.contains("超时"));
}

#[test]
fn runtime_bridge_deserializes_prompt_overrides() {
    let raw = serde_json::json!({
        "provider": "DeepSeek",
        "baseUrl": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "promptOverrides": {
            "stageBSystem": "custom system",
            "stageBInstructions": "custom instructions"
        }
    });
    let rt: PostprocessRuntimeBridge = serde_json::from_value(raw).unwrap();
    let overrides = rt.prompt_overrides.expect("prompt overrides");
    assert_eq!(overrides.stage_b_system.as_deref(), Some("custom system"));
    assert_eq!(overrides.stage_b_instructions.as_deref(), Some("custom instructions"));
}

#[test]
fn runtime_bridge_deserializes_camel_case_json() {
    let raw = serde_json::json!({
        "provider": "DeepSeek",
        "baseUrl": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "apiKeyId": "default"
    });
    let rt: PostprocessRuntimeBridge = serde_json::from_value(raw).unwrap();
    assert_eq!(rt.base_url, "https://api.deepseek.com/v1");
    assert_eq!(rt.api_key_id.as_deref(), Some("default"));
}

#[test]
fn normalize_api_key_id_rejects_api_key_shaped_values() {
    assert_eq!(
        normalize_api_key_id(Some("sk-3dad49106a1b4065b472b6894bf0ab36")),
        "default"
    );
    assert_eq!(normalize_api_key_id(Some("default")), "default");
    assert_eq!(normalize_api_key_id(Some("work")), "work");
}

#[test]
fn secret_account_for_delete_keeps_sk_shaped_legacy_account() {
    assert_eq!(
        secret_account_for_delete(Some("sk-3dad49106a1b4065b472b6894bf0ab36")),
        "sk-3dad49106a1b4065b472b6894bf0ab36"
    );
    assert_eq!(secret_account_for_delete(None), "default");
    assert_eq!(secret_account_for_delete(Some("default")), "default");
}

#[test]
fn llm_save_request_deserializes_camel_case_json() {
    let raw = serde_json::json!({
        "apiKeyId": "default",
        "apiKey": "sk-ui"
    });
    let req: super::LlmSaveApiKeyRequest = serde_json::from_value(raw).unwrap();
    assert_eq!(req.api_key, "sk-ui");
    assert_eq!(req.api_key_id.as_deref(), Some("default"));
}

use super::{
    build_auto_punctuate_prompt, build_postprocess_models_endpoint, extract_chat_completion_text,
    parse_postprocess_endpoint, probe_llm_connection, resolve_postprocess_config, LlmProbeConnectionResponse,
    PostprocessAutoPunctuateRequest, PostprocessConfig, PostprocessRuntimeBridge,
};
use serde_json::json;
use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use tokio::runtime::Builder;
use url::Url;

fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn run_probe(config: &PostprocessConfig, timeout: Duration) -> LlmProbeConnectionResponse {
    Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(probe_llm_connection(config, timeout))
}

fn spawn_http_server(status_line: &str, body: &str, delay: Duration) -> Url {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let status_line = status_line.to_string();
    let body = body.to_string();
    thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut buf = [0u8; 1024];
        let _ = stream.read(&mut buf);
        if !delay.is_zero() {
            thread::sleep(delay);
        }
        let response = format!(
            "HTTP/1.1 {status_line}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = stream.write_all(response.as_bytes());
    });
    Url::parse(&format!("http://127.0.0.1:{}/v1/chat/completions", addr.port())).unwrap()
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
            api_key_id: None,
            allow_insecure_http: false,
        }),
    };
    let cfg = resolve_postprocess_config(&req).unwrap();
    assert_eq!(cfg.endpoint.as_str(), "https://api.deepseek.com/v1/chat/completions");
    assert_eq!(cfg.model, "deepseek-chat");
}

#[test]
fn runtime_bridge_can_fallback_to_env_api_key() {
    let _guard = env_lock().lock().unwrap();
    env::set_var("RUSHI_POSTPROCESS_API_KEY", "sk-env");
    let req = PostprocessAutoPunctuateRequest {
        task: "auto_punctuate".into(),
        segment_uid: "u1".into(),
        text: "你好".into(),
        neighbor_snippets: vec![],
        runtime: Some(PostprocessRuntimeBridge {
            provider: "DeepSeek".into(),
            base_url: "https://api.deepseek.com/v1".into(),
            model: "deepseek-chat".into(),
            api_key: String::new(),
            api_key_id: Some("default".into()),
            allow_insecure_http: false,
        }),
    };
    let cfg = resolve_postprocess_config(&req).unwrap();
    env::remove_var("RUSHI_POSTPROCESS_API_KEY");
    assert_eq!(cfg.api_key, "sk-env");
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
    let endpoint = spawn_http_server("401 Unauthorized", r#"{"error":"bad key"}"#, Duration::from_millis(0));
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

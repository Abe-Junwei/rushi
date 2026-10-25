//! Loopback HTTP to rushi-asr via Rust (WebView fetch to 127.0.0.1 often fails with "Load failed").

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::local_token::apply_local_token_header;
use super::ASR_LOOPBACK_PORT;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackRequestArgs {
    pub path: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub body: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackResponse {
    pub status: u16,
    pub body: Value,
}

fn normalize_path(path: &str, method: &Method) -> Result<String, String> {
    let (route, query) = path.split_once('?').unwrap_or((path, ""));
    let allowed = match *method {
        Method::GET => matches!(
            route,
            "/" | "/health"
                | "/v1/models/catalog"
                | "/v1/models/prepare-status"
                | "/v1/transcribe/status"
        ),
        Method::POST => matches!(
            route,
            "/v1/models/prepare"
                | "/v1/models/prepare-default"
                | "/v1/models/prepare/async"
                | "/v1/models/prepare-default/async"
                | "/v1/models/prepare-cancel"
                | "/v1/models/warmup"
                | "/v1/models/unload"
                | "/v1/models/speaker/prepare"
                | "/v1/transcribe/cancel"
        ),
        _ => false,
    };
    if !allowed || path.contains('#') || path.contains('\\') {
        return Err("loopback_path_not_allowed".into());
    }
    if route == "/v1/transcribe/status" {
        let pairs: Vec<_> = url::form_urlencoded::parse(query.as_bytes()).collect();
        if pairs.len() != 1 || pairs[0].0 != "job_id" || pairs[0].1.is_empty() {
            return Err("loopback_query_not_allowed".into());
        }
    } else if path.contains('?') {
        return Err("loopback_query_not_allowed".into());
    }
    Ok(path.to_string())
}

/// rushi-asr binds `127.0.0.1` only (see `app::bind_addr`). Always connect via IPv4 loopback:
/// `http://localhost` from reqwest on macOS may target `::1` and fail while terminal `curl` still works.
fn loopback_connect_host() -> &'static str {
    "127.0.0.1"
}

use crate::packaged_hints::dev_or_packaged_str;

fn loopback_connect_error(port: u16, err: reqwest::Error) -> String {
    if err.is_connect() {
        format!(
            "本机 127.0.0.1:{port} 无 rushi-asr 在监听（侧车仅绑定 IPv4 loopback）。{}",
            dev_or_packaged_str(
                "请在终端执行：cd services/asr && source .venv/bin/activate && python -m rushi_asr；或使用 npm run desktop:dev 自动拉起侧车。",
                "请在「环境 → 本机 ASR」点「一键准备本机 ASR」或「重试内置侧车」。",
            )
        )
    } else {
        err.to_string()
    }
}

fn loopback_timeout(timeout_ms: Option<u64>) -> std::time::Duration {
    let ms = timeout_ms.unwrap_or(10_000).clamp(1_000, 900_000);
    std::time::Duration::from_millis(ms)
}

pub async fn loopback_request_json(
    args: LoopbackRequestArgs,
    port: Option<u16>,
    timeout_ms: Option<u64>,
) -> Result<LoopbackResponse, String> {
    let method_s = args
        .method
        .as_deref()
        .unwrap_or("GET")
        .trim()
        .to_uppercase();
    let method = Method::from_bytes(method_s.as_bytes())
        .map_err(|_| format!("invalid_http_method:{method_s}"))?;
    if method != Method::GET && method != Method::POST {
        return Err("loopback_method_not_allowed".into());
    }
    let path = normalize_path(&args.path, &method)?;
    let port = match port {
        None => ASR_LOOPBACK_PORT,
        Some(p) if p == ASR_LOOPBACK_PORT => ASR_LOOPBACK_PORT,
        Some(_) => return Err("loopback_port_not_allowed".into()),
    };
    let host = loopback_connect_host();
    let url = format!("http://{host}:{port}{path}");
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(loopback_timeout(timeout_ms))
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = apply_local_token_header(client.request(method, &url));
    if let Some(body) = args.body {
        req = req.json(&body);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| loopback_connect_error(port, e))?;
    let status = resp.status().as_u16();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let body = serde_json::from_str(&text).unwrap_or(Value::String(text));
    Ok(LoopbackResponse { status, body })
}

#[tauri::command]
pub async fn asr_loopback_request(
    path: String,
    method: Option<String>,
    body: Option<Value>,
    port: Option<u16>,
    timeout_ms: Option<u64>,
) -> Result<LoopbackResponse, String> {
    loopback_request_json(LoopbackRequestArgs { path, method, body }, port, timeout_ms).await
}

#[cfg(test)]
mod tests {
    use super::normalize_path;

    #[test]
    fn proxy_allows_only_declared_method_route_and_query() {
        use reqwest::Method;
        assert!(normalize_path("/health", &Method::GET).is_ok());
        assert!(normalize_path("/v1/models/unload", &Method::POST).is_ok());
        assert!(normalize_path("/v1/transcribe/status?job_id=synthetic", &Method::GET).is_ok());
        for path in [
            "//evil.test",
            "/foo/../health",
            "/%68ealth",
            "/health#x",
            "/health?x=1",
            "/openapi.json",
            "/v1/transcribe/status",
            "/v1/transcribe/status?job_id=a&job_id=b",
        ] {
            assert!(normalize_path(path, &Method::GET).is_err(), "{path}");
        }
        assert!(normalize_path("/health", &Method::POST).is_err());
        assert!(normalize_path("/v1/models/unload", &Method::GET).is_err());
    }

    #[test]
    fn loopback_port_must_match_asr_sidecar() {
        use super::LoopbackRequestArgs;
        let err = tauri::async_runtime::block_on(super::loopback_request_json(
            LoopbackRequestArgs {
                path: "/health".into(),
                method: None,
                body: None,
            },
            Some(9999),
            Some(1000),
        ))
        .unwrap_err();
        assert!(err.contains("loopback_port_not_allowed"));
    }
}

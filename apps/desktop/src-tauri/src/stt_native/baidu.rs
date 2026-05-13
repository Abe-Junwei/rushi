use std::path::Path;
use std::time::Duration;

use base64::Engine;
use serde_json::json;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

use super::audio_bytes_and_format;
use super::rushi_value;

/// 百度：持久化 API Key（bridge.app_key）+ 内存 Secret Key（authorization 原文，无 Bearer）。
pub async fn transcribe_baidu(
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let api_key = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "百度语音：请在「应用标识」中填写 API Key（client_id）".to_string())?;
    let secret = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "百度语音：请在内存凭证中填写 Secret Key（client_secret）".to_string())?;

    let token_url = format!(
        "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={}&client_secret={}",
        urlencoding::encode(api_key),
        urlencoding::encode(secret)
    );
    log("INFO baidu token fetch");
    let tr = client
        .get(&token_url)
        .timeout(Duration::from_secs(30))
        .send()
        .await;
    let tr = tr.map_err(|e| format!("百度 token 请求失败: {e}"))?;
    if !tr.status().is_success() {
        return Err(format!("百度 token HTTP {}", tr.status()));
    }
    let tj: serde_json::Value = tr.json().await.map_err(|e| e.to_string())?;
    let token = tj
        .get("access_token")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "百度 token 响应缺少 access_token".to_string())?;

    let (bytes, fmt) = audio_bytes_and_format(audio_path)?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let url = bridge.transcribe_url.trim();
    let post_url = if url.is_empty() {
        "https://vop.baidu.com/server_api"
    } else {
        url
    };
    let dev_pid = 1537;
    let rate = 16000;
    let body = json!({
        "format": fmt,
        "rate": rate,
        "channel": 1,
        "token": token,
        "cuid": "rushi-desktop",
        "dev_pid": dev_pid,
        "len": bytes.len(),
        "speech": b64,
    });
    log("INFO baidu server_api");
    let resp = client
        .post(post_url)
        .timeout(timeout)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("百度识别请求失败: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        return Err(format!(
            "百度识别 HTTP {}: {}",
            status,
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let err_no = j.get("err_no").and_then(|x| x.as_i64()).unwrap_or(-1);
    if err_no != 0 {
        let msg = j
            .get("err_msg")
            .and_then(|x| x.as_str())
            .unwrap_or("识别失败");
        return Err(format!("百度 err_no={err_no}: {msg}"));
    }
    let arr = j
        .get("result")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();
    let full_text: String = arr
        .iter()
        .filter_map(|x| x.as_str())
        .collect::<Vec<_>>()
        .join("");
    let warnings: Vec<String> = Vec::new();
    Ok(rushi_value(
        vec![],
        full_text.clone(),
        "baidu:server_api",
        None,
        warnings,
    ))
}

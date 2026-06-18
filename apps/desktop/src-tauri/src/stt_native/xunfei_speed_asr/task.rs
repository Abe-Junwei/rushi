//! 讯飞 OST 任务创建与轮询。

use std::time::{Duration, Instant};

use reqwest::Client;
use serde_json::{json, Value};

use crate::project::transcribe_cancel_cmd::{
    ensure_transcribe_not_cancelled, transcribe_poll_wait, TranscribeCancelPoll,
};

use super::auth::signed_json_headers;
use super::super::send_stt_cloud_post;

pub const XUNFEI_OST_HOST: &str = "ost-api.xfyun.cn";
const PRO_CREATE_PATH: &str = "/v2/ost/pro_create";
pub const QUERY_PATH: &str = "/v2/ost/query";
const POLL_INTERVAL: Duration = Duration::from_secs(2);

fn api_code_ok(j: &Value) -> bool {
    j.get("code")
        .and_then(|c| c.as_i64().or_else(|| c.as_str().and_then(|s| s.parse().ok())))
        == Some(0)
}

fn ost_api_code(j: &Value) -> Option<i64> {
    j.get("code")
        .and_then(|c| c.as_i64().or_else(|| c.as_str().and_then(|s| s.parse().ok())))
}

fn is_query_task_not_found(j: &Value) -> bool {
    if ost_api_code(j) == Some(10401) {
        return true;
    }
    j.get("message")
        .and_then(|m| m.as_str())
        .map(|m| m.eq_ignore_ascii_case("no data found"))
        .unwrap_or(false)
}

fn api_error_message(j: &Value) -> String {
    j.get("message")
        .or_else(|| j.get("desc"))
        .and_then(|m| m.as_str())
        .unwrap_or("讯飞转写失败")
        .to_string()
}

async fn post_ost_json(
    _client: &Client,
    path: &str,
    payload: Value,
    api_key: &str,
    api_secret: &str,
) -> Result<Value, String> {
    let body = serde_json::to_vec(&payload).map_err(|e| format!("序列化 JSON: {e}"))?;
    let url = format!("https://{XUNFEI_OST_HOST}{path}");
    let resp = send_stt_cloud_post(|c| {
        let headers = signed_json_headers(XUNFEI_OST_HOST, path, &body, api_key, api_secret);
        let mut req = c.post(&url).body(body.clone());
        for (k, v) in headers {
            req = req.header(k, v);
        }
        req
    })
    .await
    .map_err(|e| format!("讯飞 OST HTTP 失败: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取 OST 响应: {e}"))?;
    let j: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "code": -1, "message": text }));
    if !status.is_success() && !api_code_ok(&j) {
        return Err(format!("讯飞 OST HTTP {status}: {text}"));
    }
    if !api_code_ok(&j) {
        return Err(api_error_message(&j));
    }
    Ok(j)
}

async fn post_ost_query_json(
    _client: &Client,
    payload: Value,
    api_key: &str,
    api_secret: &str,
) -> Result<Value, String> {
    let body = serde_json::to_vec(&payload).map_err(|e| format!("序列化 JSON: {e}"))?;
    let url = format!("https://{XUNFEI_OST_HOST}{QUERY_PATH}");
    let resp = send_stt_cloud_post(|c| {
        let headers = signed_json_headers(XUNFEI_OST_HOST, QUERY_PATH, &body, api_key, api_secret);
        let mut req = c.post(&url).body(body.clone());
        for (k, v) in headers {
            req = req.header(k, v);
        }
        req
    })
    .await
    .map_err(|e| format!("讯飞 OST HTTP 失败: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取 OST 响应: {e}"))?;
    let j: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "code": -1, "message": text }));
    if is_query_task_not_found(&j) {
        return Err("__xunfei_query_task_not_found__".to_string());
    }
    if !status.is_success() && !api_code_ok(&j) {
        if let Some(msg) = j.get("message").and_then(|m| m.as_str()) {
            return Err(format!(
                "讯飞 OST 错误 {}：{msg}",
                ost_api_code(&j).unwrap_or(-1)
            ));
        }
        return Err(format!("讯飞 OST HTTP {status}: {text}"));
    }
    if !api_code_ok(&j) {
        return Err(api_error_message(&j));
    }
    Ok(j)
}

#[allow(clippy::too_many_arguments)]
pub async fn create_transcription_task(
    client: &Client,
    app_id: &str,
    audio_url: &str,
    audio_size: u64,
    accent: &str,
    dhw: Option<&str>,
    api_key: &str,
    api_secret: &str,
    log: &impl Fn(&str),
) -> Result<String, String> {
    let mut business = json!({
        "request_id": uuid::Uuid::new_v4().to_string(),
        "language": "zh_cn",
        "domain": "pro_ost_ed",
        "accent": accent,
        "vspp_on": 0,
        "speaker_num": 0,
    });
    if let Some(hw) = dhw.filter(|s| !s.trim().is_empty()) {
        business["dhw"] = json!(hw);
    }
    let payload = json!({
        "common": { "app_id": app_id },
        "business": business,
        "data": {
            "audio_url": audio_url,
            "audio_src": "http",
            "audio_size": audio_size,
            "format": "audio/L16;rate=16000",
            "encoding": "raw",
        }
    });
    log("INFO xunfei pro_create submit");
    let j = post_ost_json(client, PRO_CREATE_PATH, payload, api_key, api_secret).await?;
    j.pointer("/data/task_id")
        .and_then(|x| x.as_str())
        .map(str::to_string)
        .ok_or_else(|| "pro_create 缺少 task_id".to_string())
}

#[allow(clippy::too_many_arguments)]
pub async fn poll_task_result(
    client: &Client,
    app_id: &str,
    task_id: &str,
    api_key: &str,
    api_secret: &str,
    timeout: Duration,
    log: &impl Fn(&str),
    cancel: TranscribeCancelPoll<'_>,
) -> Result<Value, String> {
    let deadline = Instant::now() + timeout;
    loop {
        ensure_transcribe_not_cancelled(cancel)?;
        if Instant::now() >= deadline {
            return Err("讯飞转写轮询超时".to_string());
        }
        let payload = json!({
            "common": { "app_id": app_id },
            "business": { "task_id": task_id },
        });
        let j = match post_ost_query_json(client, payload, api_key, api_secret).await {
            Ok(v) => v,
            Err(e) if e == "__xunfei_query_task_not_found__" => {
                log("INFO xunfei query task not yet visible, retry");
                transcribe_poll_wait(POLL_INTERVAL, cancel).await?;
                continue;
            }
            Err(e) => return Err(e),
        };
        let status = j
            .pointer("/data/task_status")
            .or_else(|| j.pointer("/data/status"))
            .and_then(|s| s.as_i64().or_else(|| s.as_str().and_then(|t| t.parse().ok())))
            .unwrap_or(0);
        log(&format!("INFO xunfei query task_status={status}"));
        if status == 3 || status == 4 {
            return Ok(j);
        }
        if status < 0 {
            return Err(api_error_message(&j));
        }
        transcribe_poll_wait(POLL_INTERVAL, cancel).await?;
    }
}

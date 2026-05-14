use std::path::Path;
use std::time::Duration;

use base64::Engine;
use chrono::Utc;
use serde_json::json;
use tungstenite::{client::IntoClientRequest, Message};
use url::Url;

use http::header::HeaderValue;

use crate::online_stt_bridge::OnlineTranscribeBridge;

use super::{hmac_sha256, rushi_value, split_pipe2, wav_strip_to_pcm};

fn iflytek_auth_url(hosturl: &str, api_key: &str, api_secret: &str) -> Result<Url, String> {
    let ul = Url::parse(hosturl).map_err(|e| format!("讯飞 URL: {e}"))?;
    let date = Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    let host = ul
        .host_str()
        .ok_or_else(|| "讯飞 URL 缺少 host".to_string())?
        .to_string();
    let path = ul.path().to_string();
    let sign_lines = format!("host: {host}\ndate: {date}\nGET {path} HTTP/1.1");
    let sig = {
        let mac = hmac_sha256(api_secret.as_bytes(), sign_lines.as_bytes());
        base64::engine::general_purpose::STANDARD.encode(mac)
    };
    let auth_origin = format!(
        r#"api_key="{api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{sig}""#
    );
    let authorization = base64::engine::general_purpose::STANDARD.encode(auth_origin.as_bytes());
    let mut u = ul;
    u.query_pairs_mut()
        .append_pair("authorization", &authorization)
        .append_pair("date", &date)
        .append_pair("host", &host);
    Ok(u)
}

fn iflytek_collect_text(j: &serde_json::Value) -> String {
    let mut out = String::new();
    if let Some(ws) = j.pointer("/data/result/ws").and_then(|x| x.as_array()) {
        for w in ws {
            if let Some(cws) = w.get("cw").and_then(|x| x.as_array()) {
                for cw in cws {
                    if let Some(t) = cw.get("w").and_then(|x| x.as_str()) {
                        out.push_str(t);
                    }
                }
            }
        }
    }
    out
}

pub fn transcribe_iflytek_iat_ws(
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let app_id = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "讯飞：请在「应用标识」中填写 AppId".to_string())?;
    let secret_raw = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "讯飞：请在内存凭证中填写 `APIKey|APISecret`".to_string())?;
    let (api_key, api_secret) = split_pipe2(secret_raw, "讯飞")?;

    let base = bridge.transcribe_url.trim();
    let wss = if base.is_empty() {
        "wss://iat-api.xfyun.cn/v2/iat"
    } else {
        base
    };
    let u = iflytek_auth_url(wss, api_key, api_secret)?;
    log("INFO iflytek iat ws connect");

    let mut req = u
        .as_str()
        .into_client_request()
        .map_err(|e| format!("讯飞握手请求: {e}"))?;
    req.headers_mut().insert(
        "Host",
        HeaderValue::from_str(u.host_str().unwrap_or("")).map_err(|e| e.to_string())?,
    );

    let (mut ws, _resp) = tungstenite::connect(req).map_err(|e| format!("讯飞 WebSocket: {e}"))?;

    let (bytes, ext) = crate::stt_native::audio_bytes_and_format(audio_path)?;
    if ext == "mp3" {
        return Err("讯飞听写 WS：请使用 WAV/PCM（16k 单声道）；MP3 请转码后再试。".to_string());
    }
    let pcm_slice = wav_strip_to_pcm(&bytes);
    let encoding = "raw";

    let business = json!({
        "language": "zh_cn",
        "domain": "iat",
        "accent": "mandarin",
        "ptt": 1,
    });

    const CHUNK: usize = 1280;
    let first_take = CHUNK.min(pcm_slice.len());
    let b64_first = base64::engine::general_purpose::STANDARD.encode(&pcm_slice[..first_take]);
    let mut offset = first_take;
    let first = json!({
        "common": { "app_id": app_id },
        "business": business,
        "data": {
            "status": 0i32,
            "format": "audio/L16;rate=16000",
            "encoding": encoding,
            "audio": b64_first,
        }
    });
    ws.send(Message::Text(first.to_string()))
        .map_err(|e| format!("讯飞发送首帧: {e}"))?;

    while offset < pcm_slice.len() {
        let end = (offset + CHUNK).min(pcm_slice.len());
        let b64 = base64::engine::general_purpose::STANDARD.encode(&pcm_slice[offset..end]);
        offset = end;
        let msg = json!({
            "data": {
                "status": 1i32,
                "format": "audio/L16;rate=16000",
                "encoding": encoding,
                "audio": b64,
            }
        });
        ws.send(Message::Text(msg.to_string()))
            .map_err(|e| format!("讯飞发送音频帧: {e}"))?;
    }
    let endf = json!({ "data": { "status": 2i32 } });
    ws.send(Message::Text(endf.to_string()))
        .map_err(|e| format!("讯飞发送结束帧: {e}"))?;

    let mut full = String::new();
    let deadline = std::time::Instant::now() + timeout;
    loop {
        if std::time::Instant::now() > deadline {
            return Err("讯飞识别超时".to_string());
        }
        let m = ws.read().map_err(|e| format!("讯飞读取: {e}"))?;
        match m {
            Message::Text(t) => {
                let j: serde_json::Value = serde_json::from_str(&t).map_err(|e| e.to_string())?;
                let code = j.get("code").and_then(|x| x.as_i64()).unwrap_or(-1);
                if code != 0 {
                    let msg = j.get("message").and_then(|x| x.as_str()).unwrap_or("错误");
                    return Err(format!("讯飞 code={code}: {msg}"));
                }
                let piece = iflytek_collect_text(&j);
                if !piece.is_empty() {
                    full = piece;
                }
                let done = j
                    .pointer("/data/result/ls")
                    .and_then(|x| x.as_bool())
                    .unwrap_or(false);
                if done {
                    break;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
    let _ = ws.close(None);
    let warnings = Vec::new();
    Ok(rushi_value(
        vec![],
        full.trim().to_string(),
        "iflytek:iat:v2",
        None,
        warnings,
    ))
}

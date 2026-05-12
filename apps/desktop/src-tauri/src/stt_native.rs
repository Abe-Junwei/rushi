//! 各在线 STT 厂商原生 HTTP 调用，归一为 Rushi `TranscriptionResult` JSON（schema_version 1）。

use std::fs;
use std::path::Path;
use std::time::Duration;

use base64::Engine;
use chrono::{TimeZone, Utc};
use hmac::{Hmac, Mac};
use reqwest::blocking::multipart;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, P1OnlineTranscribeBridge};

type HmacSha256 = Hmac<Sha256>;

static HTTP: OnceLock<reqwest::blocking::Client> = OnceLock::new();

pub fn http_client() -> &'static reqwest::blocking::Client {
    HTTP.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .pool_idle_timeout(Duration::from_secs(90))
            .connect_timeout(Duration::from_secs(20))
            .build()
            .expect("reqwest blocking client")
    })
}

fn sha256_hex(data: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(data);
    hex::encode(h.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn rushi_value(
    segments: Vec<serde_json::Value>,
    full_text: String,
    engine: &str,
    duration_sec: Option<f64>,
    mut warnings: Vec<String>,
) -> serde_json::Value {
    if segments.is_empty() && !full_text.trim().is_empty() {
        warnings.push("厂商未返回分句时间戳，已退化为单条语段。".to_string());
    }
    let segs = if segments.is_empty() && !full_text.trim().is_empty() {
        vec![json!({
            "start_sec": 0.0_f64,
            "end_sec": duration_sec.unwrap_or(0.0),
            "text": full_text.trim(),
            "confidence": serde_json::Value::Null,
            "low_confidence": false,
        })]
    } else {
        segments
    };
    json!({
        "schema_version": "1",
        "segments": segs,
        "full_text": full_text,
        "engine": engine,
        "duration_sec": duration_sec,
        "warnings": warnings,
    })
}

fn audio_bytes_and_format(path: &Path) -> Result<(Vec<u8>, &'static str), String> {
    let bytes = fs::read(path).map_err(|e| format!("读取音频: {e}"))?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let fmt = match ext.as_str() {
        "wav" => "wav",
        "mp3" => "mp3",
        "m4a" | "aac" => "m4a",
        "pcm" => "pcm",
        "amr" => "amr",
        "flac" => "flac",
        "ogg" => "ogg",
        _ => "wav",
    };
    Ok((bytes, fmt))
}

/// 百度：持久化 API Key（bridge.app_key）+ 内存 Secret Key（authorization 原文，无 Bearer）。
pub fn transcribe_baidu(
    client: &reqwest::blocking::Client,
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
    let tr = client.get(&token_url).timeout(Duration::from_secs(30)).send();
    let tr = tr.map_err(|e| format!("百度 token 请求失败: {e}"))?;
    if !tr.status().is_success() {
        return Err(format!("百度 token HTTP {}", tr.status()));
    }
    let tj: serde_json::Value = tr.json().map_err(|e| e.to_string())?;
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
    let dev_pid = if fmt == "wav" || fmt == "pcm" { 1537 } else { 1537 };
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
        .map_err(|e| format!("百度识别请求失败: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().unwrap_or_default();
        return Err(format!(
            "百度识别 HTTP {}: {}",
            status,
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let err_no = j.get("err_no").and_then(|x| x.as_i64()).unwrap_or(-1);
    if err_no != 0 {
        let msg = j.get("err_msg").and_then(|x| x.as_str()).unwrap_or("识别失败");
        return Err(format!("百度 err_no={err_no}: {msg}"));
    }
    let arr = j
        .get("result")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();
    let full_text: String = arr.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("");
    let warnings: Vec<String> = Vec::new();
    Ok(rushi_value(
        vec![],
        full_text.clone(),
        "baidu:server_api",
        None,
        warnings,
    ))
}

/// 阿里云 NLS 一句话识别：`app_key`=AppKey，`authorization`=X-NLS-Token（原文）。
pub fn transcribe_aliyun_nls(
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let appkey = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "阿里云 NLS：请填写 AppKey（应用标识）".to_string())?;
    let token = bridge
        .authorization
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "阿里云 NLS：请在内存凭证中填写 X-NLS-Token".to_string())?;

    let base = bridge.transcribe_url.trim();
    let base = if base.is_empty() {
        "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr"
    } else {
        base
    };
    let (bytes, fmt) = audio_bytes_and_format(audio_path)?;
    let sample = if fmt == "pcm" { "16000" } else { "16000" };
    let url = format!(
        "{}?appkey={}&format={}&sample_rate={}",
        base.trim_end_matches('?'),
        urlencoding::encode(appkey),
        urlencoding::encode(fmt),
        sample
    );

    log("INFO aliyun nls asr");
    let resp = client
        .post(&url)
        .timeout(timeout)
        .header("X-NLS-Token", token)
        .header("Content-Type", "application/octet-stream")
        .body(bytes)
        .send()
        .map_err(|e| format!("阿里云 NLS 请求失败: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().unwrap_or_default();
        return Err(format!(
            "阿里云 NLS HTTP {}: {}",
            status,
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let status = j.get("status").and_then(|x| x.as_i64()).unwrap_or(-1);
    if status != 20000000 {
        let msg = j
            .get("message")
            .and_then(|x| x.as_str())
            .unwrap_or("识别失败");
        return Err(format!("阿里云 NLS status={status}: {msg}"));
    }
    let full_text = j
        .get("result")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let warnings: Vec<String> = Vec::new();
    Ok(rushi_value(
        vec![],
        full_text.clone(),
        "aliyun:nls:asr",
        None,
        warnings,
    ))
}

/// Deepgram：Bearer + multipart 文件；`transcribe_url` 可含 query（如 model）。
pub fn transcribe_deepgram(
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let auth = bridge
        .authorization
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Deepgram：需要 API Key（Bearer）".to_string())?;
    let auth_trim = auth.trim();
    let auth = if auth_trim.len() >= 7 && auth_trim[..7].eq_ignore_ascii_case("Bearer ") {
        format!("Token {}", auth_trim[7..].trim())
    } else if auth_trim.len() >= 6 && auth_trim[..6].eq_ignore_ascii_case("token ") {
        auth_trim.to_string()
    } else {
        format!("Token {}", auth_trim)
    };
    let url = bridge.transcribe_url.trim();
    let url = if url.is_empty() {
        "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true"
    } else {
        url
    };
    let part = multipart::Part::file(audio_path).map_err(|e| e.to_string())?;
    let form = multipart::Form::new().part("audio", part);
    log("INFO deepgram listen");
    let resp = client
        .post(url)
        .timeout(timeout)
        .header("Authorization", auth)
        .multipart(form)
        .send()
        .map_err(|e| format!("Deepgram 请求失败: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().unwrap_or_default();
        return Err(format!(
            "Deepgram HTTP {}: {}",
            status,
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let alt = j
        .pointer("/results/channels/0/alternatives/0")
        .ok_or_else(|| "Deepgram 响应缺少 results.channels[0].alternatives[0]".to_string())?;
    let full_text = alt
        .get("transcript")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let mut segments: Vec<serde_json::Value> = Vec::new();
    if let Some(words) = alt.get("words").and_then(|w| w.as_array()) {
        const GAP_SEC: f64 = 0.85;
        let mut seg_start: Option<f64> = None;
        let mut seg_end = 0.0_f64;
        let mut buf = String::new();
        for w in words {
            let s = w.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let e = w.get("end").and_then(|x| x.as_f64()).unwrap_or(s);
            let word = w.get("word").and_then(|x| x.as_str()).unwrap_or("").trim();
            if word.is_empty() {
                continue;
            }
            match seg_start {
                None => {
                    seg_start = Some(s);
                    seg_end = e;
                    buf.push_str(word);
                }
                Some(s0) => {
                    if s - seg_end > GAP_SEC {
                        let text = std::mem::take(&mut buf).trim().to_string();
                        if !text.is_empty() {
                            segments.push(json!({
                                "start_sec": s0,
                                "end_sec": seg_end,
                                "text": text,
                                "confidence": serde_json::Value::Null,
                                "low_confidence": false,
                            }));
                        }
                        seg_start = Some(s);
                        seg_end = e;
                        buf.push_str(word);
                    } else {
                        buf.push(' ');
                        buf.push_str(word);
                        seg_end = e;
                    }
                }
            }
        }
        if let Some(s0) = seg_start {
            let text = buf.trim().to_string();
            if !text.is_empty() {
                segments.push(json!({
                    "start_sec": s0,
                    "end_sec": seg_end,
                    "text": text,
                    "confidence": serde_json::Value::Null,
                    "low_confidence": false,
                }));
            }
        }
    }
    let warnings: Vec<String> = Vec::new();
    Ok(rushi_value(
        segments,
        full_text.clone(),
        "deepgram:listen",
        None,
        warnings,
    ))
}

fn tencent_tc3_authorization(
    secret_id: &str,
    secret_key: &str,
    host: &str,
    action: &str,
    _version: &str,
    payload: &str,
    timestamp: i64,
) -> Result<String, String> {
    let service = "asr";
    let algorithm = "TC3-HMAC-SHA256";
    let date = Utc.timestamp_opt(timestamp, 0)
        .single()
        .ok_or_else(|| "时间戳无效".to_string())?
        .format("%Y-%m-%d")
        .to_string();
    let credential_scope = format!("{date}/{service}/tc3_request");

    let hashed_request_payload = sha256_hex(payload.as_bytes());
    let canonical_headers = format!(
        "content-type:application/json; charset=utf-8\nhost:{host}\nx-tc-action:{}\n",
        action.to_lowercase()
    );
    let signed_headers = "content-type;host;x-tc-action";
    let canonical_request = format!(
        "POST\n/\n\n{canonical_headers}\n{signed_headers}\n{hashed_request_payload}"
    );
    let hashed_canonical_request = sha256_hex(canonical_request.as_bytes());
    let string_to_sign = format!("{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical_request}");

    let secret_date = hmac_sha256(format!("TC3{secret_key}").as_bytes(), date.as_bytes());
    let secret_service = hmac_sha256(&secret_date, service.as_bytes());
    let secret_signing = hmac_sha256(&secret_service, b"tc3_request");
    let signature = hex::encode(hmac_sha256(&secret_signing, string_to_sign.as_bytes()));

    let auth = format!(
        "{algorithm} Credential={secret_id}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    );
    Ok(auth)
}

/// 腾讯云：`app_key`=SecretId，内存 authorization=SecretKey（无 Bearer）。
pub fn transcribe_tencent(
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let secret_id = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "腾讯云：请在「应用标识」中填写 SecretId".to_string())?;
    let secret_key = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "腾讯云：请在内存凭证中填写 SecretKey".to_string())?;

    let host = "asr.tencentcloudapi.com";
    let action = "SentenceRecognition";
    let version = "2019-06-14";
    let (bytes, voice_fmt) = audio_bytes_and_format(audio_path)?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let eng = "16k_zh";
    let body = json!({
        "ProjectId": 0i64,
        "SubServiceType": 2i64,
        "EngSerViceType": eng,
        "SourceType": 1i64,
        "VoiceFormat": voice_fmt,
        "UsrAudioKey": "rushi-desktop",
        "Data": b64,
        "DataLen": bytes.len() as i64,
    });
    let payload = serde_json::to_string(&body).map_err(|e| e.to_string())?;
    let timestamp = Utc::now().timestamp();
    let authorization = tencent_tc3_authorization(secret_id, secret_key, host, action, version, &payload, timestamp)?;

    log("INFO tencent SentenceRecognition");
    let url = "https://asr.tencentcloudapi.com/";
    let resp = client
        .post(url)
        .timeout(timeout)
        .header("Authorization", authorization)
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Host", host)
        .header("X-TC-Action", action)
        .header("X-TC-Version", version)
        .header("X-TC-Timestamp", timestamp.to_string())
        .header("X-TC-Region", "ap-shanghai")
        .body(payload)
        .send()
        .map_err(|e| format!("腾讯云请求失败: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().unwrap_or_default();
        return Err(format!(
            "腾讯云 HTTP {}: {}",
            status,
            t.chars().take(500).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let resp_inner = j.get("Response").cloned().unwrap_or(j);
    if let Some(err) = resp_inner.get("Error") {
        let code = err.get("Code").and_then(|x| x.as_str()).unwrap_or("?");
        let msg = err.get("Message").and_then(|x| x.as_str()).unwrap_or("");
        return Err(format!("腾讯云错误 {code}: {msg}"));
    }
    let full_text = resp_inner
        .get("Result")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let warnings: Vec<String> = Vec::new();
    Ok(rushi_value(
        vec![],
        full_text.clone(),
        "tencent:SentenceRecognition",
        None,
        warnings,
    ))
}

fn azure_display_text(xml: &str) -> Option<String> {
    let re_start = "<DisplayText>";
    let re_end = "</DisplayText>";
    if let Some(i) = xml.find(re_start) {
        let s = i + re_start.len();
        if let Some(j) = xml[s..].find(re_end) {
            return Some(xml[s..s + j].to_string());
        }
    }
    None
}

/// Azure 对话识别 v1：内存凭证为 `Ocp-Apim-Subscription-Key`；`transcribe_url` 为完整 v1 URL（可含 language）。
pub fn transcribe_azure_conversation(
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let key = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Azure：请在内存凭证中填写订阅密钥".to_string())?;
    let url = bridge.transcribe_url.trim();
    let url = if url.is_empty() {
        "https://eastus.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=zh-CN"
    } else {
        url
    };
    let (bytes, ext) = audio_bytes_and_format(audio_path)?;
    let ct = match ext {
        "wav" => "audio/wav; codecs=audio pcm; samplerate=16000",
        "mp3" => "audio/mp3",
        _ => "audio/wav; codecs=audio pcm; samplerate=16000",
    };
    log("INFO azure conversation v1");
    let resp = client
        .post(url)
        .timeout(timeout)
        .header("Ocp-Apim-Subscription-Key", key)
        .header("Content-Type", ct)
        .header("Accept", "application/json")
        .body(bytes)
        .send()
        .map_err(|e| format!("Azure 请求失败: {e}"))?;
    let status = resp.status();
    let ctype = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    let text_body = resp.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("Azure HTTP {status}: {}", text_body.chars().take(400).collect::<String>()));
    }
    let full_text = if ctype.contains("json") {
        let j: serde_json::Value = serde_json::from_str(&text_body).map_err(|e| e.to_string())?;
        j.pointer("/NBest/0/Display")
            .and_then(|x| x.as_str())
            .or_else(|| j.get("DisplayText").and_then(|x| x.as_str()))
            .unwrap_or("")
            .to_string()
    } else {
        azure_display_text(&text_body).unwrap_or_else(|| text_body.trim().to_string())
    };
    let warnings: Vec<String> = Vec::new();
    Ok(rushi_value(
        vec![],
        full_text.clone(),
        "azure:conversation:v1",
        None,
        warnings,
    ))
}

fn google_encoding(ext: &str) -> (&'static str, i32) {
    match ext {
        "flac" => ("FLAC", 16000),
        "wav" => ("LINEAR16", 16000),
        "mp3" => ("MP3", 0),
        "ogg" => ("OGG_OPUS", 16000),
        _ => ("MP3", 0),
    }
}

/// Google Speech-to-Text v1 `speech:recognize`：内存凭证为 API Key，请求头 `X-Goog-Api-Key`。
pub fn transcribe_google(
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let api_key = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Google：请在内存凭证中填写 API Key".to_string())?;
    let url = bridge.transcribe_url.trim();
    let url = if url.is_empty() {
        "https://speech.googleapis.com/v1/speech:recognize"
    } else {
        url
    };
    let (bytes, ext) = audio_bytes_and_format(audio_path)?;
    let (enc, rate) = google_encoding(ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mut cfg = json!({
        "encoding": enc,
        "languageCode": "zh-CN",
        "enableAutomaticPunctuation": true,
    });
    if rate > 0 {
        cfg.as_object_mut()
            .expect("object")
            .insert("sampleRateHertz".to_string(), json!(rate));
    }
    let body = json!({
        "config": cfg,
        "audio": { "content": b64 },
    });
    log("INFO google speech:recognize");
    let resp = client
        .post(url)
        .timeout(timeout)
        .header("X-Goog-Api-Key", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("Google 请求失败: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().unwrap_or_default();
        return Err(format!(
            "Google HTTP {}: {}",
            status,
            t.chars().take(500).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let mut full_text = String::new();
    let mut segments: Vec<serde_json::Value> = Vec::new();
    if let Some(results) = j.get("results").and_then(|r| r.as_array()) {
        for r in results {
            if let Some(alts) = r.get("alternatives").and_then(|a| a.as_array()) {
                if let Some(a0) = alts.first() {
                    let t = a0.get("transcript").and_then(|x| x.as_str()).unwrap_or("");
                    full_text.push_str(t);
                    if let Some(words) = a0.get("words").and_then(|w| w.as_array()) {
                        for w in words {
                            let st = w
                                .get("startTime")
                                .and_then(|x| x.as_str())
                                .and_then(parse_google_time)
                                .unwrap_or(0.0);
                            let en = w
                                .get("endTime")
                                .and_then(|x| x.as_str())
                                .and_then(parse_google_time)
                                .unwrap_or(st);
                            let word = w.get("word").and_then(|x| x.as_str()).unwrap_or("").trim();
                            if !word.is_empty() {
                                segments.push(json!({
                                    "start_sec": st,
                                    "end_sec": en,
                                    "text": word,
                                    "confidence": serde_json::Value::Null,
                                    "low_confidence": false,
                                }));
                            }
                        }
                    }
                }
            }
        }
    }
    let warnings: Vec<String> = Vec::new();
    Ok(rushi_value(
        segments,
        full_text.trim().to_string(),
        "google:speech:v1",
        None,
        warnings,
    ))
}

fn parse_google_time(s: &str) -> Option<f64> {
    let s = s.trim_end_matches('s');
    s.parse::<f64>().ok()
}

pub fn dispatch_native(
    adapter: &str,
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let raw_url = bridge.transcribe_url.trim();
    if !raw_url.is_empty() && !is_allowed_stt_transcribe_url(raw_url) {
        return Err(
            "在线转写 URL 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1".to_string(),
        );
    }
    match adapter {
        "baiduSpeech" => transcribe_baidu(client, audio_path, bridge, timeout, log),
        "aliyunNls" => transcribe_aliyun_nls(client, audio_path, bridge, timeout, log),
        "deepgramListen" => transcribe_deepgram(client, audio_path, bridge, timeout, log),
        "tencentAsr" => transcribe_tencent(client, audio_path, bridge, timeout, log),
        "azureConversationV1" => transcribe_azure_conversation(client, audio_path, bridge, timeout, log),
        "googleSpeechV1" => transcribe_google(client, audio_path, bridge, timeout, log),
        _ => Err(format!("未知 native_adapter: {adapter}")),
    }
}

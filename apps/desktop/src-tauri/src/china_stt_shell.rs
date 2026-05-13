//! 国内厂商壳直连：讯飞 WS v2、华为 SIS 一句话、思必驰 LASR v2、火山豆包 v3 nostream（二进制帧）。

use std::io::Write;
use std::path::Path;
use std::time::Duration;

use base64::Engine;
use chrono::Utc;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use hmac::{Hmac, Mac};
use http::header::HeaderValue;
use reqwest::blocking::multipart;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::io::Read;
use tungstenite::{client::IntoClientRequest, Message};
use url::Url;
use uuid::Uuid;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

type HmacSha256 = Hmac<Sha256>;

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

fn split_pipe2<'a>(raw: &'a str, label: &str) -> Result<(&'a str, &'a str), String> {
    let t = raw.trim().strip_prefix("Bearer ").unwrap_or(raw).trim();
    let (a, b) = t.split_once('|').ok_or_else(|| {
        format!("{label}：请在内存凭证中使用 `公开值|密钥` 两段，以英文竖线 `|` 分隔（无空格）。")
    })?;
    let a = a.trim();
    let b = b.trim();
    if a.is_empty() || b.is_empty() {
        return Err(format!("{label}：`|` 两侧不能为空。"));
    }
    Ok((a, b))
}

fn wav_strip_to_pcm(bytes: &[u8]) -> &[u8] {
    if bytes.len() > 44 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WAVE" {
        if let Some(pos) = find_wav_data_chunk(bytes) {
            return &bytes[pos..];
        }
        return &bytes[44..];
    }
    bytes
}

fn find_wav_data_chunk(bytes: &[u8]) -> Option<usize> {
    let mut i = 12usize;
    while i + 8 <= bytes.len() {
        let sz = u32::from_le_bytes(bytes[i + 4..i + 8].try_into().ok()?) as usize;
        if &bytes[i..i + 4] == b"data" {
            return Some(i + 8);
        }
        i = i.checked_add(8)?.checked_add(sz)?;
    }
    None
}

// --- 科大讯飞 WS v2 ---

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
    bridge: &P1OnlineTranscribeBridge,
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

// --- 华为云 SIS + SDK-HMAC-SHA256 ---

#[allow(clippy::too_many_arguments)]
fn huawei_authorization(
    sk: &str,
    ak: &str,
    host: &str,
    method: &str,
    canonical_uri: &str,
    query: &str,
    body: &[u8],
    content_type: &str,
) -> Result<(String, String), String> {
    let x_sdk_date = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let mut headers: Vec<(&str, String)> = vec![
        ("content-type", content_type.to_string()),
        ("host", host.to_string()),
        ("x-sdk-date", x_sdk_date.clone()),
    ];
    headers.sort_by(|a, b| a.0.cmp(b.0));
    let canonical_headers: String = headers
        .iter()
        .map(|(k, v)| format!("{}:{}\n", k, v.trim()))
        .collect();
    let signed_headers = "content-type;host;x-sdk-date";
    let hashed_payload = sha256_hex(body);
    let canonical_request = format!(
        "{method}\n{canonical_uri}\n{query}\n{canonical_headers}\n{signed_headers}\n{hashed_payload}"
    );
    let hashed_canonical = sha256_hex(canonical_request.as_bytes());
    let string_to_sign = format!("SDK-HMAC-SHA256\n{x_sdk_date}\n{hashed_canonical}");
    let sig = hex::encode(hmac_sha256(sk.as_bytes(), string_to_sign.as_bytes()));
    let auth =
        format!("SDK-HMAC-SHA256 Access={ak}, SignedHeaders={signed_headers}, Signature={sig}");
    Ok((x_sdk_date, auth))
}

pub fn transcribe_huawei_sis_short(
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let project_id = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "华为 SIS：请在「应用标识」中填写 ProjectId".to_string())?;
    let cred = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "华为 SIS：请在内存凭证中填写 `AccessKeyId|SecretAccessKey`".to_string())?;
    let (ak, sk) = split_pipe2(cred, "华为 SIS")?;

    let base = bridge.transcribe_url.trim();
    let base = if base.is_empty() {
        "https://sis-ext.cn-north-4.myhuaweicloud.com"
    } else {
        base
    };
    let u = Url::parse(base).map_err(|e| format!("华为 endpoint URL: {e}"))?;
    let host = u
        .host_str()
        .ok_or_else(|| "华为 endpoint 缺少 host".to_string())?;
    let scheme = u.scheme();

    let (bytes, ext) = crate::stt_native::audio_bytes_and_format(audio_path)?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let audio_format = match ext {
        "mp3" => "mp3",
        "wav" => "wav",
        "pcm" => "pcm16k16bit",
        "amr" => "amr",
        "flac" => "auto",
        _ => "auto",
    };
    let body = json!({
        "config": {
            "audio_format": audio_format,
            "property": "chinese_16k_general",
            "add_punc": "yes",
            "need_word_info": "yes",
        },
        "data": b64,
    });
    let payload = serde_json::to_vec(&body).map_err(|e| e.to_string())?;
    let path = format!("/v1/{project_id}/asr/short-audio/");
    let (x_sdk_date, auth) = huawei_authorization(
        sk,
        ak,
        host,
        "POST",
        &path,
        "",
        &payload,
        "application/json",
    )?;
    let url = format!("{scheme}://{host}{path}");
    log("INFO huawei SIS RecognizeShortAudio");
    let resp = client
        .post(&url)
        .timeout(timeout)
        .header("Content-Type", "application/json")
        .header("Host", host)
        .header("X-Sdk-Date", x_sdk_date)
        .header("Authorization", auth)
        .body(payload)
        .send()
        .map_err(|e| format!("华为请求失败: {e}"))?;
    if !resp.status().is_success() {
        let st = resp.status();
        let t = resp.text().unwrap_or_default();
        return Err(format!(
            "华为 SIS HTTP {st}: {}",
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    if let Some(ec) = j.get("error_code").and_then(|x| x.as_str()) {
        let em = j.get("error_msg").and_then(|x| x.as_str()).unwrap_or("");
        return Err(format!("华为 SIS {ec}: {em}"));
    }
    let full = j
        .pointer("/result/text")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let mut segments: Vec<serde_json::Value> = Vec::new();
    if let Some(words) = j.pointer("/result/word_info").and_then(|x| x.as_array()) {
        for w in words {
            let bg = w.get("start_time").and_then(|x| x.as_i64()).unwrap_or(0) as f64 / 1000.0;
            let ed = w.get("end_time").and_then(|x| x.as_i64()).unwrap_or(0) as f64 / 1000.0;
            let text = w.get("word").and_then(|x| x.as_str()).unwrap_or("").trim();
            if !text.is_empty() {
                segments.push(json!({
                    "start_sec": bg,
                    "end_sec": ed,
                    "text": text,
                    "confidence": serde_json::Value::Null,
                    "low_confidence": false,
                }));
            }
        }
    }
    let warnings = Vec::new();
    Ok(rushi_value(
        segments,
        full,
        "huawei:sis:short-audio",
        None,
        warnings,
    ))
}

// --- 思必驰 LASR v2 ---

pub fn transcribe_aispeech_lasr(
    client: &reqwest::blocking::Client,
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let product_id = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "思必驰：请在「应用标识」中填写 ProductId".to_string())?;
    let api_key = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "思必驰：请在内存凭证中填写 apiKey（控制台云对云授权）".to_string())?;

    let base = bridge.transcribe_url.trim();
    let base = if base.is_empty() {
        "https://lasr.duiopen.com/lasr-sentence-api/v2/sentence"
    } else {
        base.trim_end_matches('?')
    };
    let url = format!(
        "{}?productId={}&apiKey={}",
        base,
        urlencoding::encode(product_id),
        urlencoding::encode(api_key)
    );
    let ext = audio_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let audio_type = match ext.as_str() {
        "mp3" => "mp3",
        "pcm" => "pcm",
        "ogg" => "ogg",
        _ => "wav",
    };
    let params = json!({
        "request_id": Uuid::new_v4().to_string(),
        "audio": {
            "audio_type": audio_type,
            "sample_rate": 16000,
            "channel": 1,
            "sample_bytes": 2,
        },
        "asr": { "lang": "cn", "use_vad": true, "use_post": true, "use_segment": true },
    });
    let params_s = params.to_string();
    let file_part = multipart::Part::file(audio_path).map_err(|e| e.to_string())?;
    let form = multipart::Form::new()
        .text("params", params_s)
        .part("file", file_part);

    log("INFO aispeech lasr sentence");
    let resp = client
        .post(&url)
        .timeout(timeout)
        .multipart(form)
        .send()
        .map_err(|e| format!("思必驰请求失败: {e}"))?;
    if !resp.status().is_success() {
        let st = resp.status();
        let t = resp.text().unwrap_or_default();
        return Err(format!(
            "思必驰 HTTP {st}: {}",
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let errno = j.get("errno").and_then(|x| x.as_i64()).unwrap_or(-1);
    if errno != 0 {
        let err = j
            .get("error")
            .and_then(|x| x.as_str())
            .unwrap_or("识别失败");
        return Err(format!("思必驰 errno={errno}: {err}"));
    }
    let data = j.get("data").cloned().unwrap_or(json!({}));
    let mut segments: Vec<serde_json::Value> = Vec::new();
    let mut full = String::new();
    if let Some(segs) = data.get("segments").and_then(|x| x.as_array()) {
        for s in segs {
            let bg = s.get("bg").and_then(|x| x.as_i64()).unwrap_or(0) as f64 / 1000.0;
            let ed = s.get("ed").and_then(|x| x.as_i64()).unwrap_or(0) as f64 / 1000.0;
            let t = s
                .get("onebest")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim();
            if !t.is_empty() {
                full.push_str(t);
                segments.push(json!({
                    "start_sec": bg,
                    "end_sec": ed,
                    "text": t,
                    "confidence": serde_json::Value::Null,
                    "low_confidence": false,
                }));
            }
        }
    }
    if full.is_empty() {
        if let Some(arr) = data.get("result").and_then(|x| x.as_array()) {
            for r in arr {
                let t = r
                    .get("onebest")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .trim();
                if !t.is_empty() {
                    full.push_str(t);
                }
            }
        }
    }
    let warnings = Vec::new();
    Ok(rushi_value(
        segments,
        full.trim().to_string(),
        "aispeech:lasr:v2",
        None,
        warnings,
    ))
}

// --- 火山豆包 v3 bigmodel_nostream（二进制 + gzip）---

const VOLC_MSG_FULL_CLIENT: u8 = 0x01;
const VOLC_MSG_AUDIO_ONLY: u8 = 0x02;
const VOLC_MSG_FULL_SERVER: u8 = 0x09;

fn volc_hdr(
    version: u8,
    message_type: u8,
    flags: u8,
    serialization: u8,
    compression: u8,
) -> [u8; 4] {
    [
        version << 4,
        (message_type << 4) | (flags & 0x0f),
        (serialization << 4) | (compression & 0x0f),
        0,
    ]
}

fn volc_pack_binary(mut header: [u8; 4], seq: Option<u32>, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    match seq {
        None => {
            header[0] = (header[0] & 0xf0) | 0x01;
            out.extend_from_slice(&header);
        }
        Some(s) => {
            header[0] = (header[0] & 0xf0) | 0x02;
            out.extend_from_slice(&header);
            out.extend_from_slice(&s.to_be_bytes());
        }
    }
    out.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    out.extend_from_slice(payload);
    out
}

fn volc_gzip_bytes(raw: &[u8]) -> Result<Vec<u8>, String> {
    let mut enc = GzEncoder::new(Vec::new(), Compression::default());
    enc.write_all(raw).map_err(|e| e.to_string())?;
    enc.finish().map_err(|e| e.to_string())
}

fn volc_gunzip(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut dec = GzDecoder::new(data);
    let mut out = Vec::new();
    dec.read_to_end(&mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

/// 返回 (JSON, 是否为最后一包 full server response)
fn volc_parse_server_binary(bin: &[u8]) -> Result<Option<(serde_json::Value, bool)>, String> {
    if bin.len() < 8 {
        return Ok(None);
    }
    let header_size = (bin[0] & 0x0f) as usize * 4;
    if bin.len() < header_size + 4 {
        return Ok(None);
    }
    let msg_type = (bin[1] >> 4) & 0x0f;
    let flags = bin[1] & 0x0f;
    let compression = bin[2] & 0x0f;
    let mut off = header_size;
    let payload_len = u32::from_be_bytes(bin[off..off + 4].try_into().unwrap()) as usize;
    off += 4;
    if bin.len() < off + payload_len {
        return Ok(None);
    }
    let payload = &bin[off..off + payload_len];
    if msg_type != VOLC_MSG_FULL_SERVER {
        return Ok(None);
    }
    let json_bytes = if compression == 1 {
        volc_gunzip(payload)?
    } else {
        payload.to_vec()
    };
    let j: serde_json::Value =
        serde_json::from_slice(&json_bytes).map_err(|e| format!("火山响应 JSON: {e}"))?;
    let is_final = flags & 0x03 == 0x03;
    Ok(Some((j, is_final)))
}

pub fn transcribe_volcengine_bigmodel_nostream_ws(
    audio_path: &Path,
    bridge: &P1OnlineTranscribeBridge,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let app_key = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "火山引擎：请在「应用标识」中填写 X-Api-App-Key（AppId）".to_string())?;
    let access_key = bridge
        .authorization
        .as_deref()
        .map(|s| s.trim().strip_prefix("Bearer ").unwrap_or(s).trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "火山引擎：请在内存凭证中填写 X-Api-Access-Key（控制台 Access Token）".to_string()
        })?;

    let res_id_raw = bridge.transcribe_url.trim();
    let is_http_url = url::Url::parse(res_id_raw)
        .map(|u| matches!(u.scheme(), "http" | "https"))
        .unwrap_or(false);
    let resource_id = if res_id_raw.is_empty() || is_http_url {
        "volc.bigasr.sauc.duration"
    } else {
        res_id_raw
    };

    let wss = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
    let mut req = wss
        .into_client_request()
        .map_err(|e| format!("火山 WS 请求: {e}"))?;
    {
        let h = req.headers_mut();
        h.insert(
            "X-Api-App-Key",
            HeaderValue::from_str(app_key).map_err(|e| e.to_string())?,
        );
        h.insert(
            "X-Api-Access-Key",
            HeaderValue::from_str(access_key).map_err(|e| e.to_string())?,
        );
        h.insert(
            "X-Api-Resource-Id",
            HeaderValue::from_str(resource_id).map_err(|e| e.to_string())?,
        );
        h.insert(
            "X-Api-Connect-Id",
            HeaderValue::from_str(&Uuid::new_v4().to_string()).map_err(|e| e.to_string())?,
        );
    }

    log("INFO volcengine bigmodel_nostream ws");
    let (mut ws, _resp) = tungstenite::connect(req).map_err(|e| format!("火山 WebSocket: {e}"))?;

    let (bytes, ext) = crate::stt_native::audio_bytes_and_format(audio_path)?;
    let format = match ext {
        "mp3" => "mp3",
        "wav" => "wav",
        "ogg" => "ogg",
        _ => "wav",
    };
    let full_req = json!({
        "user": { "uid": "rushi-desktop" },
        "audio": {
            "format": format,
            "rate": 16000,
            "bits": 16,
            "channel": 1,
            "language": "zh-CN",
        },
        "request": {
            "model_name": "bigmodel",
            "enable_itn": true,
            "enable_punc": true,
            "show_utterances": true,
        }
    });
    let gz = volc_gzip_bytes(full_req.to_string().as_bytes())?;
    let h1 = volc_hdr(1, VOLC_MSG_FULL_CLIENT, 0, 1, 1);
    let frame1 = volc_pack_binary(h1, None, &gz);
    ws.send(Message::Binary(frame1))
        .map_err(|e| format!("火山发送 full client: {e}"))?;

    const CHUNK: usize = 6400;
    let mut seq: u32 = 1;
    let mut off = 0usize;
    while off < bytes.len() {
        let end = (off + CHUNK).min(bytes.len());
        let chunk = &bytes[off..end];
        off = end;
        let is_last = off >= bytes.len();
        let gz_a = volc_gzip_bytes(chunk)?;
        let flags = if is_last { 0b0010u8 } else { 0b0000u8 };
        let h2 = volc_hdr(1, VOLC_MSG_AUDIO_ONLY, flags, 0, 1);
        let frame = volc_pack_binary(h2, Some(seq), &gz_a);
        seq = seq.wrapping_add(1);
        ws.send(Message::Binary(frame))
            .map_err(|e| format!("火山发送音频: {e}"))?;
    }

    let deadline = std::time::Instant::now() + timeout;
    let mut last_text = String::new();
    let mut segments: Vec<serde_json::Value> = Vec::new();
    let mut finished = false;
    while !finished {
        if std::time::Instant::now() > deadline {
            return Err("火山识别超时".to_string());
        }
        let m = ws.read().map_err(|e| format!("火山读取: {e}"))?;
        match m {
            Message::Binary(bin) => {
                if let Some((j, is_final)) = volc_parse_server_binary(&bin)? {
                    if let Some(t) = j.pointer("/result/text").and_then(|x| x.as_str()) {
                        last_text = t.to_string();
                    }
                    if let Some(utt) = j.pointer("/result/utterances").and_then(|x| x.as_array()) {
                        segments.clear();
                        for u in utt {
                            let text = u.get("text").and_then(|x| x.as_str()).unwrap_or("").trim();
                            if text.is_empty() {
                                continue;
                            }
                            let start_ms = u
                                .get("start_time")
                                .and_then(|x| x.as_f64())
                                .or_else(|| {
                                    u.get("start_time")
                                        .and_then(|x| x.as_i64().map(|n| n as f64))
                                })
                                .unwrap_or(0.0);
                            let end_ms = u
                                .get("end_time")
                                .and_then(|x| x.as_f64())
                                .or_else(|| {
                                    u.get("end_time").and_then(|x| x.as_i64().map(|n| n as f64))
                                })
                                .unwrap_or(start_ms);
                            segments.push(json!({
                                "start_sec": start_ms / 1000.0,
                                "end_sec": end_ms / 1000.0,
                                "text": text,
                                "confidence": serde_json::Value::Null,
                                "low_confidence": false,
                            }));
                        }
                    }
                    if is_final {
                        finished = true;
                    }
                }
            }
            Message::Close(_) => {
                finished = true;
            }
            _ => {}
        }
    }
    let _ = ws.close(None);
    let warnings = Vec::new();
    Ok(rushi_value(
        segments,
        last_text.trim().to_string(),
        "volcengine:bigmodel_nostream:v3",
        None,
        warnings,
    ))
}

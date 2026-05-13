use std::path::Path;
use std::time::Duration;

use base64::Engine;
use chrono::Utc;
use serde_json::json;
use url::Url;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

use super::{hmac_sha256, rushi_value, sha256_hex, split_pipe2};

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

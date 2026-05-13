use std::path::Path;
use std::time::Duration;

use base64::Engine;
use chrono::{TimeZone, Utc};
use serde_json::json;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

use super::audio_bytes_and_format;
use super::{hmac_sha256, rushi_value, sha256_hex};

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
    let date = Utc
        .timestamp_opt(timestamp, 0)
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
    let canonical_request =
        format!("POST\n/\n\n{canonical_headers}\n{signed_headers}\n{hashed_request_payload}");
    let hashed_canonical_request = sha256_hex(canonical_request.as_bytes());
    let string_to_sign =
        format!("{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical_request}");

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
    let authorization = tencent_tc3_authorization(
        secret_id, secret_key, host, action, version, &payload, timestamp,
    )?;

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

use std::path::Path;
use std::time::Duration;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

use super::audio_bytes_and_format;
use super::rushi_value;

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
    let sample = "16000";
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

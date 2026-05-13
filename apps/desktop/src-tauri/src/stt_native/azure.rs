use std::path::Path;
use std::time::Duration;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

use super::audio_bytes_and_format;
use super::rushi_value;

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
        return Err(format!(
            "Azure HTTP {status}: {}",
            text_body.chars().take(400).collect::<String>()
        ));
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

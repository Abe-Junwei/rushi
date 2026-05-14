use std::path::Path;
use std::time::Duration;

use serde_json::json;

use crate::online_stt_bridge::OnlineTranscribeBridge;

use super::rushi_value;

/// Deepgram：Bearer + multipart 文件；`transcribe_url` 可含 query（如 model）。
pub async fn transcribe_deepgram(
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
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
    let part = super::multipart_part_from_file(audio_path).await?;
    let form = reqwest::multipart::Form::new().part("audio", part);
    log("INFO deepgram listen");
    let resp = client
        .post(url)
        .timeout(timeout)
        .header("Authorization", auth)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Deepgram 请求失败: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let t = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Deepgram HTTP {}: {}",
            status,
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
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

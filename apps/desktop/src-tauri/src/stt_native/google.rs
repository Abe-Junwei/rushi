use std::path::Path;
use std::time::Duration;

use base64::Engine;
use serde_json::json;

use crate::online_stt_bridge::P1OnlineTranscribeBridge;

use super::audio_bytes_and_format;
use super::rushi_value;

fn google_encoding(ext: &str) -> (&'static str, i32) {
    match ext {
        "flac" => ("FLAC", 16000),
        "wav" => ("LINEAR16", 16000),
        "mp3" => ("MP3", 0),
        "ogg" => ("OGG_OPUS", 16000),
        _ => ("MP3", 0),
    }
}

fn parse_google_time(s: &str) -> Option<f64> {
    let s = s.trim_end_matches('s');
    s.parse::<f64>().ok()
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

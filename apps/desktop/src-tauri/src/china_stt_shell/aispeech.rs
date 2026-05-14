use std::path::Path;
use std::time::Duration;

use serde_json::json;
use uuid::Uuid;

use crate::online_stt_bridge::OnlineTranscribeBridge;

use super::rushi_value;

pub async fn transcribe_aispeech_lasr(
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
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
    let file_part = crate::stt_native::multipart_part_from_file(audio_path).await?;
    let form = reqwest::multipart::Form::new()
        .text("params", params_s)
        .part("file", file_part);

    log("INFO aispeech lasr sentence");
    let resp = client
        .post(&url)
        .timeout(timeout)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("思必驰请求失败: {e}"))?;
    if !resp.status().is_success() {
        let st = resp.status();
        let t = resp.text().await.unwrap_or_default();
        return Err(format!(
            "思必驰 HTTP {st}: {}",
            t.chars().take(400).collect::<String>()
        ));
    }
    let j: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
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

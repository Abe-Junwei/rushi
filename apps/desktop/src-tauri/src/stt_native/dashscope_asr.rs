use std::path::Path;
use std::time::Duration;

use base64::Engine;
use serde_json::json;

use crate::online_stt_bridge::OnlineTranscribeBridge;
use crate::project::stt_vocabulary::SttVocabularyPlan;

use super::audio_bytes_and_format;
use super::dashscope_vocabulary::{sync_dashscope_vocabulary, DASHSCOPE_FUNASR_REALTIME_MODEL};
use super::rushi_value;

const DASHSCOPE_MULTIMODAL_GENERATION_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

/// 百炼 multimodal-generation Base64 data-uri 单条上限（官方 20 MiB）。
pub const DASHSCOPE_DATA_URI_MAX_BYTES: usize = 20 * 1024 * 1024;

pub fn dashscope_sync_data_uri_exceeds_limit(data_uri_len: usize) -> bool {
    data_uri_len > DASHSCOPE_DATA_URI_MAX_BYTES
}

/// 估算 `data:{mime};base64,{payload}` 字节长度（与 [`transcribe_dashscope_asr`] 一致）。
pub fn estimate_dashscope_data_uri_len(audio_bytes: usize, fmt: &str) -> usize {
    let mime = audio_mime_for_format(fmt);
    let prefix_len = format!("data:{mime};base64,").len();
    let b64_len = audio_bytes.div_ceil(3) * 4;
    prefix_len + b64_len
}

pub fn format_dashscope_sync_audio_too_large_error(audio_bytes: usize, data_uri_len: usize) -> String {
    let file_mb = audio_bytes as f64 / (1024.0 * 1024.0);
    let payload_mb = data_uri_len as f64 / (1024.0 * 1024.0);
    format!(
        "百炼 Fun-ASR 同步识别单段 Base64 音频上限为 20 MB（指编码后的 data-uri 体积，不是原始文件大小）。\
         当前文件约 {file_mb:.1} MB，编码后约 {payload_mb:.1} MB，已超过上限。\
         请先用本机 ASR 转写，或导出更短/更小的音频（推荐 MP3；WAV 体积约为 MP3 的 10 倍）；长音频 URL 异步识别将在后续版本支持。"
    )
}

fn dashscope_http_error_message(
    status: reqwest::StatusCode,
    text: &str,
    audio_bytes: usize,
    fmt: &str,
) -> String {
    if text.contains("TooLarge") || text.contains("20971520") {
        return format_dashscope_sync_audio_too_large_error(
            audio_bytes,
            estimate_dashscope_data_uri_len(audio_bytes, fmt),
        );
    }
    if let Ok(j) = serde_json::from_str::<serde_json::Value>(text) {
        if j.get("code")
            .and_then(|x| x.as_str())
            .is_some_and(|c| c == "BadRequest.TooLarge")
        {
            return format_dashscope_sync_audio_too_large_error(
                audio_bytes,
                estimate_dashscope_data_uri_len(audio_bytes, fmt),
            );
        }
    }
    format!(
        "百炼 ASR HTTP {}: {}",
        status,
        text.chars().take(400).collect::<String>()
    )
}

fn audio_mime_for_format(fmt: &str) -> &'static str {
    match fmt {
        "wav" | "pcm" => "audio/wav",
        "mp3" => "audio/mpeg",
        "m4a" | "aac" => "audio/mp4",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "amr" => "audio/amr",
        "opus" => "audio/opus",
        _ => "audio/wav",
    }
}

fn strip_bearer(raw: &str) -> &str {
    raw.trim().strip_prefix("Bearer ").unwrap_or(raw.trim()).trim()
}

fn format_for_dashscope(fmt: &str) -> &'static str {
    match fmt {
        "wav" | "pcm" => "wav",
        "mp3" => "mp3",
        "m4a" | "aac" => "mp4",
        "ogg" => "ogg",
        "flac" => "flac",
        "amr" => "amr",
        "opus" => "opus",
        _ => "wav",
    }
}

/// 阿里云百炼 Fun-ASR Realtime（multimodal-generation + Base64 音频 + 可选 vocabulary_id）。
pub async fn transcribe_dashscope_asr(
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
    vocabulary: &SttVocabularyPlan,
    timeout: Duration,
    log: &impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let api_key = bridge
        .authorization
        .as_deref()
        .map(strip_bearer)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "百炼 ASR：请在内存凭证中填写百炼 API Key（sk-…）".to_string())?;

    let url = bridge.transcribe_url.trim();
    let url = if url.is_empty() {
        DASHSCOPE_MULTIMODAL_GENERATION_URL
    } else {
        url
    };

    let (bytes, fmt) = audio_bytes_and_format(audio_path)?;
    let mime = audio_mime_for_format(fmt);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_uri = format!("data:{mime};base64,{b64}");
    if dashscope_sync_data_uri_exceeds_limit(data_uri.len()) {
        return Err(format_dashscope_sync_audio_too_large_error(bytes.len(), data_uri.len()));
    }

    let vocabulary_id = if vocabulary.is_empty() {
        None
    } else {
        match bridge.authorization.as_deref() {
            Some(auth) => sync_dashscope_vocabulary(client, auth, vocabulary, log).await?,
            None => None,
        }
    };

    let dash_format = format_for_dashscope(fmt);

    let mut parameters = json!({
        "format": dash_format,
    });
    if let Some(ref vid) = vocabulary_id {
        parameters["vocabulary_id"] = json!(vid);
    }

    let body = json!({
        "model": DASHSCOPE_FUNASR_REALTIME_MODEL,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "audio": data_uri }
                    ]
                }
            ]
        },
        "parameters": parameters,
        "resources": []
    });

    log(&format!(
        "INFO dashscope {} vocabulary={} audio_bytes={}",
        DASHSCOPE_FUNASR_REALTIME_MODEL,
        vocabulary_id.as_deref().unwrap_or("none"),
        bytes.len()
    ));
    let resp = super::send_stt_cloud_post(|client| {
        client
            .post(url)
            .timeout(timeout)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .header("X-DashScope-SSE", "disable")
            .json(&body)
    })
    .await
    .map_err(|e| format!("百炼 ASR 请求失败: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(dashscope_http_error_message(status, &text, bytes.len(), fmt));
    }

    let j: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("百炼 ASR JSON: {e}"))?;
    if let Some(err) = j.get("error") {
        let msg = err
            .get("message")
            .and_then(|x| x.as_str())
            .unwrap_or("识别失败");
        return Err(format!("百炼 ASR: {msg}"));
    }
    if let Some(code) = j.get("code").and_then(|x| x.as_str()) {
        if !code.is_empty() && code != "Success" {
            let msg = j
                .get("message")
                .and_then(|x| x.as_str())
                .unwrap_or("识别失败");
            return Err(format!("百炼 ASR {code}: {msg}"));
        }
    }

    let full_text = j
        .pointer("/output/text")
        .and_then(|x| x.as_str())
        .or_else(|| j.pointer("/output/sentence/text").and_then(|x| x.as_str()))
        .unwrap_or("")
        .trim()
        .to_string();

    if full_text.is_empty() {
        return Err("百炼 ASR 返回空文本；请检查 API Key 权限、音频格式与时长。".to_string());
    }

    let mut segments: Vec<serde_json::Value> = Vec::new();
    if let Some(words) = j.pointer("/output/sentence/words").and_then(|w| w.as_array()) {
        if !words.is_empty() {
            let start = words
                .first()
                .and_then(|w| w.get("begin_time"))
                .and_then(|x| x.as_f64())
                .unwrap_or(0.0)
                / 1000.0;
            let end = words
                .last()
                .and_then(|w| w.get("end_time"))
                .and_then(|x| x.as_f64())
                .unwrap_or(start * 1000.0)
                / 1000.0;
            segments.push(json!({
                "start_sec": start,
                "end_sec": end.max(start),
                "text": full_text,
                "confidence": serde_json::Value::Null,
                "low_confidence": false,
            }));
        }
    }

    let mut warnings = Vec::new();
    if vocabulary_id.is_none() && !vocabulary.is_empty() {
        warnings.push("online_vocabulary_sync_failed".to_string());
    }

    Ok(rushi_value(
        segments,
        full_text,
        &format!("dashscope:{DASHSCOPE_FUNASR_REALTIME_MODEL}"),
        None,
        warnings,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_uri_limit_is_20_mib() {
        assert_eq!(DASHSCOPE_DATA_URI_MAX_BYTES, 20_971_520);
    }

    #[test]
    fn detects_oversized_data_uri() {
        assert!(!dashscope_sync_data_uri_exceeds_limit(DASHSCOPE_DATA_URI_MAX_BYTES));
        assert!(dashscope_sync_data_uri_exceeds_limit(DASHSCOPE_DATA_URI_MAX_BYTES + 1));
    }

    #[test]
    fn maps_too_large_http_body_to_friendly_message() {
        let body = r#"{"code":"BadRequest.TooLarge","message":"Exceeded limit on max bytes per data-uri item : 20971520"}"#;
        let raw = 25 * 1024 * 1024;
        let msg = dashscope_http_error_message(reqwest::StatusCode::BAD_REQUEST, body, raw, "wav");
        assert!(msg.contains("20 MB"));
        assert!(msg.contains("编码后"));
        assert!(msg.contains("25.0 MB"));
    }

    #[test]
    fn fifteen_mb_wav_fits_sync_limit_before_base64() {
        let raw = 15 * 1024 * 1024;
        assert!(!dashscope_sync_data_uri_exceeds_limit(estimate_dashscope_data_uri_len(raw, "wav")));
    }

    #[test]
    fn seventeen_mb_wav_exceeds_sync_limit_after_base64() {
        let raw = 17 * 1024 * 1024;
        let uri_len = estimate_dashscope_data_uri_len(raw, "wav");
        assert!(dashscope_sync_data_uri_exceeds_limit(uri_len));
        let msg = format_dashscope_sync_audio_too_large_error(raw, uri_len);
        assert!(msg.contains("17.0 MB"));
        assert!(msg.contains("编码后"));
    }
}

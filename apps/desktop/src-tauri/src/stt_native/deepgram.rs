use std::path::Path;
use std::time::Duration;

use serde_json::json;

use crate::online_stt_bridge::OnlineTranscribeBridge;
use crate::project::online_segment_normalize::{
    deepgram_words_to_timed_words, timed_words_to_json, timed_words_to_segments,
    OnlineSegmentNormalizeOptions,
};
use crate::project::stt_vocabulary::{append_deepgram_keywords, SttVocabularyPlan};
use crate::project::transcribe_cancel_cmd::{
    ensure_transcribe_not_cancelled, TranscribeCancelPoll,
};

use super::rushi_value;

/// Deepgram：Bearer + multipart 文件；`transcribe_url` 可含 query（如 model）。
pub async fn transcribe_deepgram(
    _client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
    vocabulary: &SttVocabularyPlan,
    timeout: Duration,
    log: &impl Fn(&str),
    cancel: TranscribeCancelPoll<'_>,
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
    let raw_url = bridge.transcribe_url.trim();
    let base_url = if raw_url.is_empty() {
        "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true"
    } else {
        raw_url
    };
    let url = append_deepgram_keywords(base_url, vocabulary);
    let part = super::multipart_part_from_file(audio_path).await?;
    let form = reqwest::multipart::Form::new().part("audio", part);
    log("INFO deepgram listen");
    ensure_transcribe_not_cancelled(cancel)?;
    let url = url.clone();
    let auth = auth.clone();
    let build = |client: &reqwest::Client| {
        client
            .post(&url)
            .timeout(timeout)
            .header("Authorization", &auth)
    };
    let primary = build(super::http_client()).multipart(form).send().await;
    let resp = match primary {
        Ok(r) => r,
        Err(e) if super::is_retryable_stt_transport(&e) => {
            ensure_transcribe_not_cancelled(cancel)?;
            let part = super::multipart_part_from_file(audio_path).await?;
            let form = reqwest::multipart::Form::new().part("audio", part);
            build(super::http_client_direct())
                .multipart(form)
                .send()
                .await
                .map_err(|e| format!("Deepgram 请求失败: {e}"))?
        }
        Err(e) => return Err(format!("Deepgram 请求失败: {e}")),
    };
    ensure_transcribe_not_cancelled(cancel)?;
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
    let mut timed_words_json: Vec<serde_json::Value> = Vec::new();
    if let Some(words) = alt.get("words").and_then(|w| w.as_array()) {
        let timed = deepgram_words_to_timed_words(words);
        timed_words_json = timed_words_to_json(&timed);
        segments = timed_words_to_segments(&timed, &OnlineSegmentNormalizeOptions::default());
    }
    let warnings: Vec<String> = Vec::new();
    let mut out = rushi_value(
        segments,
        full_text.clone(),
        "deepgram:listen",
        None,
        warnings,
    );
    if !timed_words_json.is_empty() {
        out["timed_words"] = json!(timed_words_json);
    }
    Ok(out)
}

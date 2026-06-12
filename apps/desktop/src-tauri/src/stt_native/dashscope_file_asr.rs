//! 百炼 Fun-ASR 录音文件异步转写（`file_urls` + Job 轮询）。

use std::path::Path;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::online_stt_bridge::OnlineTranscribeBridge;
use crate::project::online_segment_normalize::{
    funasr_file_words_to_timed, funasr_word_piece, refine_long_speech_segments,
    timed_words_to_json, OnlineSegmentNormalizeOptions,
};
use crate::project::stt_vocabulary::SttVocabularyPlan;
use crate::project::transcribe_cancel_cmd::{
    ensure_transcribe_not_cancelled, transcribe_poll_wait, TranscribeCancelPoll,
};

use super::dashscope_upload::upload_dashscope_temp_oss_url;
use super::dashscope_vocabulary::{sync_dashscope_vocabulary, DASHSCOPE_FUNASR_FILE_MODEL};
use super::{rushi_value, send_stt_cloud_get, send_stt_cloud_post};

pub const DASHSCOPE_FILE_TRANSCRIPTION_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
pub const DASHSCOPE_TASKS_URL: &str = "https://dashscope.aliyuncs.com/api/v1/tasks";

const POLL_INTERVAL: Duration = Duration::from_secs(2);

type FunasrFileTranscriptionParse = (Vec<Value>, String, Option<f64>, Vec<Value>);

fn json_f64(v: &Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_i64().map(|n| n as f64))
        .or_else(|| v.as_u64().map(|n| n as f64))
}

fn strip_bearer(raw: &str) -> &str {
    raw.trim()
        .strip_prefix("Bearer ")
        .unwrap_or(raw.trim())
        .trim()
}

fn assemble_text_from_words(words: &[Value]) -> String {
    words
        .iter()
        .map(funasr_word_piece)
        .filter(|s| !s.trim().is_empty())
        .collect()
}

fn push_speech_segment(out: &mut Vec<Value>, start_ms: u64, end_ms: u64, text: &str) {
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    out.push(json!({
        "start_sec": start_ms as f64 / 1000.0,
        "end_sec": end_ms.max(start_ms) as f64 / 1000.0,
        "text": text,
        "confidence": Value::Null,
        "low_confidence": false,
        "kind": "speech",
    }));
}

fn segments_for_sentence(sentence: &Value) -> (Vec<Value>, Vec<Value>) {
    let begin_ms = sentence.get("begin_time").and_then(json_f64).unwrap_or(0.0);
    let end_ms = sentence
        .get("end_time")
        .and_then(json_f64)
        .unwrap_or(begin_ms)
        .max(begin_ms);
    let fallback_text = sentence
        .get("text")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let Some(words_json) = sentence.get("words").and_then(|w| w.as_array()) else {
        if fallback_text.is_empty() {
            return (Vec::new(), Vec::new());
        }
        let mut segments = Vec::new();
        push_speech_segment(
            &mut segments,
            begin_ms.max(0.0) as u64,
            end_ms.max(begin_ms) as u64,
            &fallback_text,
        );
        return (segments, Vec::new());
    };

    if words_json.is_empty() {
        if fallback_text.is_empty() {
            return (Vec::new(), Vec::new());
        }
        let mut segments = Vec::new();
        push_speech_segment(
            &mut segments,
            begin_ms.max(0.0) as u64,
            end_ms.max(begin_ms) as u64,
            &fallback_text,
        );
        return (segments, Vec::new());
    }

    let assembled = assemble_text_from_words(words_json);
    let text = if assembled.trim().is_empty() {
        fallback_text
    } else {
        assembled
    };
    if text.trim().is_empty() {
        return (Vec::new(), Vec::new());
    }

    let timed = funasr_file_words_to_timed(words_json, begin_ms);
    let timed_words_json = timed_words_to_json(&timed);
    let mut segments = Vec::new();
    push_speech_segment(
        &mut segments,
        begin_ms.max(0.0) as u64,
        end_ms.max(begin_ms) as u64,
        &text,
    );
    (segments, timed_words_json)
}

/// 解析 Fun-ASR 文件转写结果 JSON（`transcription_url` 下载体）。
pub fn parse_funasr_file_transcription(j: &Value) -> Result<FunasrFileTranscriptionParse, String> {
    let duration_sec = j
        .pointer("/properties/original_duration_in_milliseconds")
        .and_then(json_f64)
        .map(|ms| ms / 1000.0);
    let transcripts = j
        .get("transcripts")
        .and_then(|t| t.as_array())
        .ok_or_else(|| "百炼文件转写结果缺少 transcripts".to_string())?;

    let mut segments: Vec<Value> = Vec::new();
    let mut timed_words: Vec<Value> = Vec::new();

    for tr in transcripts {
        if let Some(sentences) = tr.get("sentences").and_then(|s| s.as_array()) {
            for sentence in sentences {
                let (mut sentence_segments, mut sentence_words) = segments_for_sentence(sentence);
                segments.append(&mut sentence_segments);
                timed_words.append(&mut sentence_words);
            }
        } else if let Some(text) = tr.get("text").and_then(|x| x.as_str()) {
            let text = text.trim();
            if !text.is_empty() {
                let end = duration_sec.unwrap_or(0.0);
                segments.push(json!({
                    "start_sec": 0.0_f64,
                    "end_sec": end,
                    "text": text,
                    "confidence": Value::Null,
                    "low_confidence": false,
                    "kind": "speech",
                }));
            }
        }
    }

    if segments.is_empty() {
        return Err("百炼文件转写未返回分句".to_string());
    }

    let mut all_timed = Vec::new();
    for tr in transcripts {
        if let Some(sentences) = tr.get("sentences").and_then(|s| s.as_array()) {
            for sentence in sentences {
                if let Some(words) = sentence.get("words").and_then(|w| w.as_array()) {
                    let begin = sentence.get("begin_time").and_then(json_f64).unwrap_or(0.0);
                    all_timed.extend(funasr_file_words_to_timed(words, begin));
                }
            }
        }
    }

    let refine_opts = OnlineSegmentNormalizeOptions::cjk_oral();
    segments = refine_long_speech_segments(segments, &all_timed, &refine_opts);

    let full_parts: Vec<String> = segments
        .iter()
        .filter_map(|s| s.get("text").and_then(|t| t.as_str()).map(str::to_string))
        .collect();
    let full_text = full_parts.join("");
    Ok((segments, full_text, duration_sec, timed_words))
}

pub async fn transcribe_dashscope_file_asr(
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
    vocabulary: &SttVocabularyPlan,
    timeout: Duration,
    log: &impl Fn(&str),
    cancel: TranscribeCancelPoll<'_>,
) -> Result<Value, String> {
    let api_key = bridge
        .authorization
        .as_deref()
        .map(strip_bearer)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "百炼 ASR：请在内存凭证中填写百炼 API Key（sk-…）".to_string())?;

    let oss_url = upload_dashscope_temp_oss_url(
        client,
        api_key,
        DASHSCOPE_FUNASR_FILE_MODEL,
        audio_path,
        log,
    )
    .await?;

    let vocabulary_id = if vocabulary.is_empty() {
        None
    } else {
        match bridge.authorization.as_deref() {
            Some(auth) => sync_dashscope_vocabulary(client, auth, vocabulary, log).await?,
            None => None,
        }
    };

    let mut parameters = json!({
        "channel_id": [0],
        "language_hints": ["zh"],
    });
    if let Some(ref vid) = vocabulary_id {
        parameters["vocabulary_id"] = json!(vid);
    }

    let body = json!({
        "model": DASHSCOPE_FUNASR_FILE_MODEL,
        "input": {
            "file_urls": [oss_url]
        },
        "parameters": parameters,
    });

    log(&format!(
        "INFO dashscope file_asr submit model={} vocabulary={}",
        DASHSCOPE_FUNASR_FILE_MODEL,
        vocabulary_id.as_deref().unwrap_or("none")
    ));

    ensure_transcribe_not_cancelled(cancel)?;
    let submit_resp = send_stt_cloud_post(|http| {
        http.post(DASHSCOPE_FILE_TRANSCRIPTION_URL)
            .timeout(timeout)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .header("X-DashScope-Async", "enable")
            .header("X-DashScope-OssResourceResolve", "enable")
            .json(&body)
    })
    .await
    .map_err(|e| format!("百炼文件转写提交失败: {e}"))?;

    if !submit_resp.status().is_success() {
        let status = submit_resp.status();
        let text = submit_resp.text().await.unwrap_or_default();
        return Err(format!(
            "百炼文件转写 HTTP {}: {}",
            status,
            text.chars().take(400).collect::<String>()
        ));
    }

    let submitted: Value = submit_resp.json().await.map_err(|e| e.to_string())?;
    let task_id = submitted
        .pointer("/output/task_id")
        .or_else(|| submitted.get("task_id"))
        .and_then(|x| x.as_str())
        .ok_or_else(|| "百炼文件转写未返回 task_id".to_string())?;

    let deadline = Instant::now() + timeout;
    loop {
        ensure_transcribe_not_cancelled(cancel)?;
        if Instant::now() > deadline {
            return Err("百炼文件转写轮询超时".to_string());
        }
        transcribe_poll_wait(POLL_INTERVAL, cancel).await?;
        ensure_transcribe_not_cancelled(cancel)?;
        let poll_url = format!("{DASHSCOPE_TASKS_URL}/{task_id}");
        let poll_resp = send_stt_cloud_get(|http| {
            http.get(&poll_url)
                .timeout(Duration::from_secs(30))
                .header("Authorization", format!("Bearer {api_key}"))
                .header("X-DashScope-OssResourceResolve", "enable")
        })
        .await
        .map_err(|e| format!("百炼任务查询失败: {e}"))?;
        if !poll_resp.status().is_success() {
            let status = poll_resp.status();
            let body = poll_resp.text().await.unwrap_or_default();
            return Err(format!(
                "百炼任务查询 HTTP {}: {}",
                status,
                body.chars().take(400).collect::<String>()
            ));
        }
        let poll: Value = poll_resp.json().await.map_err(|e| e.to_string())?;
        let status = poll
            .pointer("/output/task_status")
            .or_else(|| poll.get("task_status"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        match status {
            "SUCCEEDED" => {
                let transcription_url = poll
                    .pointer("/output/results/0/transcription_url")
                    .and_then(|x| x.as_str())
                    .ok_or_else(|| "百炼任务成功但缺少 transcription_url".to_string())?;
                log("INFO dashscope file_asr fetch_result");
                let result_resp = send_stt_cloud_get(|http| {
                    http.get(transcription_url)
                        .timeout(Duration::from_secs(60))
                        .header("Authorization", format!("Bearer {api_key}"))
                })
                .await
                .map_err(|e| format!("百炼转写结果下载失败: {e}"))?;
                if !result_resp.status().is_success() {
                    let st = result_resp.status();
                    let body = result_resp.text().await.unwrap_or_default();
                    return Err(format!(
                        "百炼转写结果 HTTP {}: {}",
                        st,
                        body.chars().take(400).collect::<String>()
                    ));
                }
                let result_json: Value = result_resp.json().await.map_err(|e| e.to_string())?;
                let (segments, full_text, duration_sec, timed_words) =
                    parse_funasr_file_transcription(&result_json)?;
                log(&format!(
                    "INFO dashscope file_asr segments={} full_text_len={}",
                    segments.len(),
                    full_text.chars().count()
                ));
                let mut warnings = Vec::new();
                if vocabulary_id.is_none() && !vocabulary.is_empty() {
                    warnings.push("online_vocabulary_sync_failed".to_string());
                }
                let mut out = rushi_value(
                    segments,
                    full_text,
                    &format!("dashscope:{DASHSCOPE_FUNASR_FILE_MODEL}:file"),
                    duration_sec,
                    warnings,
                );
                if !timed_words.is_empty() {
                    out["timed_words"] = json!(timed_words);
                }
                return Ok(out);
            }
            "FAILED" | "CANCELED" => {
                let msg = poll
                    .pointer("/output/message")
                    .or_else(|| poll.pointer("/output/code"))
                    .and_then(|x| x.as_str())
                    .unwrap_or("转写失败");
                return Err(format!("百炼文件转写: {msg}"));
            }
            "PENDING" | "RUNNING" | "SCHEDULED" => continue,
            _ => continue,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_file_transcription_sentences() {
        let j: Value = serde_json::from_str(
            r#"{
            "properties": { "original_duration_in_milliseconds": 12000 },
            "transcripts": [{
                "channel_id": 0,
                "sentences": [
                    { "begin_time": 100, "end_time": 2500, "text": "第一句。", "words": [
                        { "begin_time": 100, "end_time": 500, "text": "第", "punctuation": "" },
                        { "begin_time": 500, "end_time": 2500, "text": "一句", "punctuation": "。" }
                    ]},
                    { "begin_time": 3000, "end_time": 5800, "text": "第二句。" }
                ]
            }]
        }"#,
        )
        .expect("json");
        let (segments, full_text, dur, words) = parse_funasr_file_transcription(&j).expect("parse");
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0]["text"], "第一句。");
        assert_eq!(segments[1]["text"], "第二句。");
        assert_eq!(full_text, "第一句。第二句。");
        assert_eq!(dur, Some(12.0));
        assert!(!words.is_empty());
    }

    #[test]
    fn prefers_word_punctuation_over_bare_sentence_text() {
        let j: Value = serde_json::from_str(
            r#"{
            "properties": { "original_duration_in_milliseconds": 5000 },
            "transcripts": [{
                "sentences": [{
                    "begin_time": 0,
                    "end_time": 2000,
                    "text": "你好世界",
                    "words": [
                        { "begin_time": 0, "end_time": 800, "text": "你好", "punctuation": "，" },
                        { "begin_time": 800, "end_time": 2000, "text": "世界", "punctuation": "。" }
                    ]
                }]
            }]
        }"#,
        )
        .expect("json");
        let (segments, _, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0]["text"], "你好，世界。");
    }

    #[test]
    fn refines_long_cloud_sentence_via_shared_normalize() {
        let j: Value = serde_json::from_str(
            r#"{
            "properties": { "original_duration_in_milliseconds": 40000 },
            "transcripts": [{
                "sentences": [{
                    "begin_time": 0,
                    "end_time": 32000,
                    "text": "甲很长乙也很长",
                    "words": [
                        { "begin_time": 0, "end_time": 500, "text": "甲", "punctuation": "，" },
                        { "begin_time": 500, "end_time": 1200, "text": "很长", "punctuation": "。" },
                        { "begin_time": 12000, "end_time": 12500, "text": "乙", "punctuation": "，" },
                        { "begin_time": 12500, "end_time": 13200, "text": "也很长", "punctuation": "。" }
                    ]
                }]
            }]
        }"#,
        )
        .expect("json");
        let (segments, full_text, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert!(
            segments.len() >= 2,
            "expected refine, got {}",
            segments.len()
        );
        assert_eq!(segments[0]["text"], "甲，很长。");
        assert_eq!(segments[1]["text"], "乙，也很长。");
        assert_eq!(full_text, "甲，很长。乙，也很长。");
    }

    #[test]
    fn keeps_short_cloud_sentence_as_single_segment() {
        let j: Value = serde_json::from_str(
            r#"{
            "transcripts": [{
                "sentences": [{
                    "begin_time": 1000,
                    "end_time": 3500,
                    "text": "短句。",
                    "words": [
                        { "begin_time": 1000, "end_time": 2000, "text": "短", "punctuation": "" },
                        { "begin_time": 2000, "end_time": 3500, "text": "句", "punctuation": "。" }
                    ]
                }]
            }]
        }"#,
        )
        .expect("json");
        let (segments, _, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0]["text"], "短句。");
    }

    #[test]
    fn refines_runon_oral_without_internal_punct() {
        let mut words_json = String::from("[");
        let word_count = 24;
        let total_ms = 32_600;
        for i in 0..word_count {
            if i > 0 {
                words_json.push(',');
            }
            let begin = i * total_ms / word_count;
            let end = (i + 1) * total_ms / word_count;
            let punct = if i + 1 == word_count { "。" } else { "" };
            words_json.push_str(&format!(
                r#"{{ "begin_time": {begin}, "end_time": {end}, "text": "词{i}", "punctuation": "{punct}" }}"#
            ));
        }
        words_json.push(']');
        let j: Value = serde_json::from_str(&format!(
            r#"{{
            "properties": {{ "original_duration_in_milliseconds": {total_ms} }},
            "transcripts": [{{
                "sentences": [{{
                    "begin_time": 0,
                    "end_time": {total_ms},
                    "text": "很长 oral",
                    "words": {words_json}
                }}]
            }}]
        }}"#
        ))
        .expect("json");
        let (segments, full_text, _, _) = parse_funasr_file_transcription(&j).expect("parse");
        assert!(
            segments.len() >= 3,
            "expected forced refine, got {}",
            segments.len()
        );
        assert!(full_text.ends_with('。'));
    }

    #[test]
    fn file_asr_poll_interval_exits_when_transcribe_cancelled() {
        use crate::project::transcribe_cancel_cmd::{
            transcribe_cancel_by_request_id, transcribe_poll_wait, TranscribeCancelState,
            TRANSCRIBE_CANCELLED_MESSAGE,
        };
        use futures_util::future::AbortHandle;

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .expect("tokio runtime");
        rt.block_on(async {
            let state = TranscribeCancelState::default();
            let (handle, _reg) = AbortHandle::new_pair();
            state
                .0
                .lock()
                .unwrap()
                .insert("dashscope-task".to_string(), handle);
            let started = tokio::time::Instant::now();
            let poll = transcribe_poll_wait(POLL_INTERVAL, Some((&state, "dashscope-task")));
            let cancel = async {
                tokio::time::sleep(Duration::from_millis(50)).await;
                assert!(transcribe_cancel_by_request_id(&state, "dashscope-task").unwrap());
            };
            let (poll_out, _) = tokio::join!(poll, cancel);
            assert_eq!(poll_out.unwrap_err(), TRANSCRIBE_CANCELLED_MESSAGE);
            assert!(
                started.elapsed() < POLL_INTERVAL,
                "poll should abort before full Dashscope interval"
            );
        });
    }
}

//! 百炼 Fun-ASR 录音文件异步转写（`file_urls` + Job 轮询）。

use std::path::Path;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::online_stt_bridge::OnlineTranscribeBridge;
use crate::project::stt_vocabulary::SttVocabularyPlan;
use crate::project::transcribe_cancel_cmd::{
    ensure_transcribe_not_cancelled, transcribe_poll_wait, TranscribeCancelPoll,
};

use super::dashscope_file_asr_parse::parse_funasr_file_transcription;
use super::dashscope_upload::{is_allowed_dashscope_resource_url, upload_dashscope_temp_oss_url};
use super::dashscope_vocabulary::{sync_dashscope_vocabulary, DASHSCOPE_FUNASR_FILE_MODEL};
use super::{rushi_value, send_stt_cloud_get, send_stt_cloud_post};

pub const DASHSCOPE_FILE_TRANSCRIPTION_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
pub const DASHSCOPE_TASKS_URL: &str = "https://dashscope.aliyuncs.com/api/v1/tasks";

const POLL_INTERVAL: Duration = Duration::from_secs(2);

fn strip_bearer(raw: &str) -> &str {
    raw.trim()
        .strip_prefix("Bearer ")
        .unwrap_or(raw.trim())
        .trim()
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
                if !is_allowed_dashscope_resource_url(transcription_url) {
                    return Err("百炼转写结果地址不在允许的 HTTPS 阿里云域名下".to_string());
                }
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
    use std::time::Duration;

    use crate::project::transcribe_cancel_cmd::{
        transcribe_cancel_by_request_id, transcribe_poll_wait, TranscribeCancelState,
        TRANSCRIBE_CANCELLED_MESSAGE,
    };
    use futures_util::future::AbortHandle;

    use super::POLL_INTERVAL;

    #[test]
    fn file_asr_poll_interval_exits_when_transcribe_cancelled() {
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

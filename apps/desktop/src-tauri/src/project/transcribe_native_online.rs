use super::stt_vocabulary::openai_prompt;
use super::transcribe::{assemblyai_transcript_json_to_rushi, openai_verbose_json_to_rushi};
use super::transcribe_cancel_cmd::{
    ensure_transcribe_not_cancelled, transcribe_poll_wait, TranscribeCancelPoll,
};
use super::utils::append_desktop_log_line;
use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, OnlineTranscribeBridge};
use crate::project::stt_vocabulary::{assemblyai_keyterms, SttVocabularyPlan};
use crate::DbState;
use std::path::Path;
use std::time::{Duration, Instant};

pub async fn transcribe_openai_native(
    st: &DbState,
    audio_path: &Path,
    vocabulary: &SttVocabularyPlan,
    o: &OnlineTranscribeBridge,
    timeout: Duration,
    cancel: TranscribeCancelPoll<'_>,
) -> Result<serde_json::Value, String> {
    let url = o.transcribe_url.trim();
    if url.is_empty() {
        return Err("在线转写 URL 为空".to_string());
    }
    if !is_allowed_stt_transcribe_url(url) {
        return Err(
            "在线转写 URL 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1".to_string(),
        );
    }
    let auth_ok = o
        .authorization
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_some();
    if !auth_ok {
        return Err("OpenAI 转写需要 Authorization（Bearer Token）。".to_string());
    }
    let part = crate::stt_native::multipart_part_from_file(audio_path).await?;
    let mut form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-1")
        .text("response_format", "verbose_json")
        .text("timestamp_granularities[]", "word")
        .text("timestamp_granularities[]", "segment");
    if let Some(p) = openai_prompt(vocabulary) {
        form = form.text("prompt", p);
    }
    append_desktop_log_line(st, "INFO transcribe openai_native");
    ensure_transcribe_not_cancelled(cancel)?;
    let mut req = crate::stt_native::http_client()
        .post(url)
        .timeout(timeout)
        .multipart(form);
    if let Some(a) = o.authorization.as_deref() {
        let t = a.trim();
        if !t.is_empty() {
            req = req.header("Authorization", t);
        }
    }
    let resp = req.send().await.map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR openai transcribe connect {e}"));
        format!("OpenAI 请求失败: {e}")
    })?;
    ensure_transcribe_not_cancelled(cancel)?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(500).collect();
        append_desktop_log_line(
            st,
            &format!("ERROR openai transcribe http {} {}", status, snippet),
        );
        return Err(format!("OpenAI HTTP {}: {}", status, snippet));
    }
    let val: serde_json::Value = resp.json().await.map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR openai transcribe json {e}"));
        e.to_string()
    })?;
    openai_verbose_json_to_rushi(&val)
}

pub async fn transcribe_assemblyai_native(
    st: &DbState,
    audio_path: &Path,
    vocabulary: &SttVocabularyPlan,
    o: &OnlineTranscribeBridge,
    timeout: Duration,
    cancel: TranscribeCancelPoll<'_>,
) -> Result<serde_json::Value, String> {
    let base = o.transcribe_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("AssemblyAI base URL 为空".to_string());
    }
    if !is_allowed_stt_transcribe_url(base) {
        return Err(
            "AssemblyAI base 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1".to_string(),
        );
    }
    let auth = o
        .authorization
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "AssemblyAI 缺少 authorization / API Key".to_string())?;
    let deadline = Instant::now() + timeout;
    let client = crate::stt_native::http_client();
    let bytes = crate::stt_native::read_audio_bytes_limited(audio_path)
        .map_err(|e| format!("读取音频失败: {e}"))?;
    append_desktop_log_line(st, "INFO transcribe assemblyai_upload");
    ensure_transcribe_not_cancelled(cancel)?;
    let upload_res = client
        .post(format!("{base}/v2/upload"))
        .timeout(timeout)
        .header("authorization", auth)
        .header("Content-Type", "application/octet-stream")
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("AssemblyAI 上传失败: {e}"))?;
    if !upload_res.status().is_success() {
        let status = upload_res.status();
        let body = upload_res.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(400).collect();
        return Err(format!("AssemblyAI 上传 HTTP {status}: {snippet}"));
    }
    let upload_json: serde_json::Value = upload_res.json().await.map_err(|e| e.to_string())?;
    let audio_url = upload_json
        .get("upload_url")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "AssemblyAI 上传响应缺少 upload_url".to_string())?;
    append_desktop_log_line(st, "INFO transcribe assemblyai_create");
    ensure_transcribe_not_cancelled(cancel)?;
    let keyterms = assemblyai_keyterms(vocabulary);
    let mut create_body = serde_json::json!({ "audio_url": audio_url });
    if !keyterms.is_empty() {
        create_body["keyterms_prompt"] = serde_json::json!(keyterms);
    }
    let create_res = client
        .post(format!("{base}/v2/transcript"))
        .timeout(timeout)
        .header("authorization", auth)
        .header("Content-Type", "application/json")
        .json(&create_body)
        .send()
        .await
        .map_err(|e| format!("AssemblyAI 创建任务失败: {e}"))?;
    if !create_res.status().is_success() {
        let status = create_res.status();
        let body = create_res.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(400).collect();
        return Err(format!("AssemblyAI 创建转写 HTTP {status}: {snippet}"));
    }
    let created: serde_json::Value = create_res.json().await.map_err(|e| e.to_string())?;
    let tid = created
        .get("id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "AssemblyAI 创建响应缺少 id".to_string())?;
    loop {
        ensure_transcribe_not_cancelled(cancel)?;
        if Instant::now() > deadline {
            return Err("AssemblyAI 轮询超时".to_string());
        }
        transcribe_poll_wait(Duration::from_secs(2), cancel).await?;
        ensure_transcribe_not_cancelled(cancel)?;
        let poll = client
            .get(format!("{base}/v2/transcript/{tid}"))
            .timeout(Duration::from_secs(30))
            .header("authorization", auth)
            .send()
            .await
            .map_err(|e| format!("AssemblyAI 轮询失败: {e}"))?;
        if !poll.status().is_success() {
            let status = poll.status();
            let body = poll.text().await.unwrap_or_default();
            let snippet: String = body.chars().take(400).collect();
            return Err(format!("AssemblyAI 状态 HTTP {status}: {snippet}"));
        }
        let j: serde_json::Value = poll.json().await.map_err(|e| e.to_string())?;
        match j.get("status").and_then(|s| s.as_str()) {
            Some("completed") => {
                append_desktop_log_line(st, "INFO transcribe assemblyai_completed");
                return assemblyai_transcript_json_to_rushi(&j);
            }
            Some("error") => {
                let msg = j
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("转写失败");
                return Err(format!("AssemblyAI: {msg}"));
            }
            Some("queued") | Some("processing") => continue,
            _ => continue,
        }
    }
}

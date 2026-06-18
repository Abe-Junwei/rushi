//! 讯飞 speedTranscription 长音频转写入口。

mod auth;
mod normalize;
mod parse;
mod probe;
mod task;
mod upload;

pub use probe::probe_credentials_blocking;

use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::online_stt_bridge::OnlineTranscribeBridge;
use crate::project::stt_vocabulary::{xunfei_hotword_dhw, SttVocabularyPlan};
use crate::project::transcribe_cancel_cmd::TranscribeCancelPoll;

use super::{read_audio_bytes_limited, rushi_value};

const ENGINE: &str = "iflytek:speed-transcription:file";

fn strip_bearer(raw: &str) -> &str {
    raw.trim()
        .strip_prefix("Bearer ")
        .unwrap_or(raw.trim())
        .trim()
}

fn extract_credentials(bridge: &OnlineTranscribeBridge) -> Result<(String, String, String), String> {
    let app_id = bridge
        .app_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "讯飞 AppID 未配置".to_string())?;
    let api_key = bridge
        .authorization
        .as_deref()
        .map(strip_bearer)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "讯飞 APIKey 未配置".to_string())?;
    let api_secret = bridge
        .api_secret
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "讯飞 APISecret 未配置".to_string())?;
    Ok((app_id.to_string(), api_key.to_string(), api_secret.to_string()))
}

fn resolve_accent(bridge: &OnlineTranscribeBridge) -> String {
    bridge
        .accent
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("mandarin")
        .to_string()
}

pub async fn transcribe_xunfei_speed_asr(
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
    vocabulary: &SttVocabularyPlan,
    timeout: Duration,
    log: &impl Fn(&str),
    cancel: TranscribeCancelPoll<'_>,
) -> Result<serde_json::Value, String> {
    let (app_id, api_key, api_secret) = extract_credentials(bridge)?;
    let accent = resolve_accent(bridge);

    let work_dir = std::env::temp_dir().join(format!("xunfei_asr_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&work_dir).map_err(|e| format!("创建临时目录: {e}"))?;
    let cleanup = WorkDirCleanup(work_dir.clone());

    let upload_path = normalize::prepare_upload_wav(audio_path, &work_dir)?;
    let audio_size = read_audio_bytes_limited(&upload_path)?.len() as u64;

    let (dhw, vocab_warnings) = xunfei_hotword_dhw(vocabulary);
    if let Some(ref hw) = dhw {
        log(&format!("INFO xunfei dhw chars={}", hw.chars().count()));
    }

    let audio_url = upload::upload_audio_file(
        client,
        &app_id,
        &upload_path,
        &api_key,
        &api_secret,
        log,
    )
    .await?;

    let task_id = task::create_transcription_task(
        client,
        &app_id,
        &audio_url,
        audio_size,
        &accent,
        dhw.as_deref(),
        &api_key,
        &api_secret,
        log,
    )
    .await?;

    let query_json = task::poll_task_result(
        client,
        &app_id,
        &task_id,
        &api_key,
        &api_secret,
        timeout,
        log,
        cancel,
    )
    .await?;

    let (segments, full_text, duration_sec) = parse::parse_lattice_result(&query_json)?;
    log(&format!(
        "INFO xunfei speed_asr segments={} full_text_len={}",
        segments.len(),
        full_text.chars().count()
    ));

    drop(cleanup);
    Ok(rushi_value(
        segments,
        full_text,
        ENGINE,
        duration_sec,
        vocab_warnings,
    ))
}

struct WorkDirCleanup(PathBuf);

impl Drop for WorkDirCleanup {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

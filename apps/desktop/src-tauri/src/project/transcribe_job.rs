//! R3e-C: async transcribe job HTTP helpers (sidecar poll + cancel).

use super::transcribe::{post_transcribe_multipart, TranscribeHttpOptions, TranscribeRequestAuth};
use super::transcribe_errors::{
    describe_transcribe_http_status_error, describe_transcribe_request_error,
};
use super::transcribe_timeline::TranscribeTimelineRecorder;
use super::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::utils::{redact_http_body_snippet, redact_secrets_for_log};
use crate::DbState;
use std::path::Path;
use std::time::Duration;

/// All local FunASR file transcribe uses async preview (R3e-C); online STT stays blocking.
#[cfg(test)]
pub fn should_use_transcribe_async(_audio_duration_sec: Option<f64>, online: bool) -> bool {
    !online
}

pub async fn post_transcribe_async_multipart(
    st: &DbState,
    base_url: &str,
    audio_path: &Path,
    hotwords: String,
    diarization_requested: bool,
    timeout: Duration,
    timeline: Option<&mut TranscribeTimelineRecorder>,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/v1/transcribe/async", base_url.trim_end_matches('/'));
    post_transcribe_multipart(
        st,
        &url,
        audio_path,
        hotwords,
        diarization_requested,
        TranscribeHttpOptions {
            auth: TranscribeRequestAuth::default(),
            timeout,
            cancel: None,
        },
        timeline,
    )
    .await
}

pub async fn prepare_speaker_model(
    st: &DbState,
    base_url: &str,
    timeout: Duration,
) -> Result<(), String> {
    let url = format!(
        "{}/v1/models/speaker/prepare",
        base_url.trim_end_matches('/')
    );
    let resp = crate::asr_sidecar::local_token::apply_local_token_if_asr_loopback(
        http_client().post(&url).timeout(timeout),
        &url,
    )
    .send()
    .await
    .map_err(|e| {
        append_desktop_log_line(st, "ERROR speaker_model_prepare connect");
        describe_transcribe_request_error(&e, timeout)
    })?;
    if resp.status().is_success() {
        return Ok(());
    }
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    let snippet = redact_http_body_snippet(&body);
    append_desktop_log_line(
        st,
        &format!("ERROR speaker_model_prepare http {} {}", status, snippet),
    );
    Err(format!("说话人模型准备失败（HTTP {status}）：{snippet}"))
}

pub async fn get_transcribe_job_status(
    st: &DbState,
    base_url: &str,
    job_id: &str,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let url = format!(
        "{}/v1/transcribe/status?job_id={}",
        base_url.trim_end_matches('/'),
        urlencoding::encode(job_id)
    );
    let resp = crate::asr_sidecar::local_token::apply_local_token_if_asr_loopback(
        http_client().get(&url).timeout(timeout),
        url.as_str(),
    )
    .send()
    .await
    .map_err(|e| {
        append_desktop_log_line(
            st,
            &format!(
                "ERROR transcribe_status connect {}",
                redact_secrets_for_log(&e.to_string())
            ),
        );
        describe_transcribe_request_error(&e, timeout)
    })?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet = redact_http_body_snippet(&body);
        append_desktop_log_line(
            st,
            &format!("ERROR transcribe_status http {} {}", status, snippet),
        );
        if let Some(msg) = describe_transcribe_http_status_error(status.as_u16(), &snippet) {
            return Err(msg);
        }
        return Err(format!("ASR status HTTP {}: {}", status, snippet));
    }
    resp.json().await.map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR transcribe_status json {e}"));
        e.to_string()
    })
}

pub fn parse_transcribe_job_phase(v: &serde_json::Value) -> &str {
    v.get("phase").and_then(|x| x.as_str()).unwrap_or("unknown")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn async_for_all_local_audio() {
        assert!(should_use_transcribe_async(None, false));
        assert!(should_use_transcribe_async(Some(30.0), false));
        assert!(should_use_transcribe_async(Some(3600.0), false));
        assert!(!should_use_transcribe_async(Some(3600.0), true));
    }

    #[test]
    fn parse_phase() {
        let v = serde_json::json!({ "phase": "transcribing", "job_id": "abc" });
        assert_eq!(parse_transcribe_job_phase(&v), "transcribing");
    }
}

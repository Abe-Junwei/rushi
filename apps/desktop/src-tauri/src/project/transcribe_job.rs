//! R3e-C: async transcribe job HTTP helpers (sidecar poll + cancel).

use super::transcribe::post_transcribe_multipart;
use super::transcribe_errors::{
    describe_transcribe_http_status_error, describe_transcribe_request_error,
};
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
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/v1/transcribe/async", base_url.trim_end_matches('/'));
    post_transcribe_multipart(st, &url, audio_path, hotwords, None, None, timeout).await
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

/// Used by UI via loopback fetch today; kept for a future Tauri command path.
#[allow(dead_code)]
pub async fn post_transcribe_cancel(
    st: &DbState,
    base_url: &str,
    job_id: &str,
    timeout: Duration,
) -> Result<(), String> {
    let url = format!("{}/v1/transcribe/cancel", base_url.trim_end_matches('/'));
    let resp = crate::asr_sidecar::local_token::apply_local_token_if_asr_loopback(
        http_client()
            .post(&url)
            .json(&serde_json::json!({ "job_id": job_id }))
            .timeout(timeout),
        url.as_str(),
    )
    .send()
    .await
    .map_err(|e| {
        append_desktop_log_line(
            st,
            &format!(
                "ERROR transcribe_cancel connect {}",
                redact_secrets_for_log(&e.to_string())
            ),
        );
        describe_transcribe_request_error(&e, timeout)
    })?;
    let status_code = resp.status();
    if !status_code.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet = redact_http_body_snippet(&body);
        append_desktop_log_line(
            st,
            &format!("ERROR transcribe_cancel http {} {}", status_code, snippet),
        );
        if let Some(msg) = describe_transcribe_http_status_error(status_code.as_u16(), &snippet) {
            return Err(msg);
        }
        return Err(format!("ASR cancel HTTP {}: {}", status_code, snippet));
    }
    Ok(())
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

use super::super::ensure_not_cancelled;
use std::fs;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub(crate) const VERIFY_HEALTH_TIMEOUT: Duration = Duration::from_secs(90);
pub(crate) const VERIFY_HEALTH_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
pub(crate) const VERIFY_HEALTH_POLL: Duration = Duration::from_millis(250);
const VERIFY_LOG_TAIL_BYTES: usize = 8 * 1024;

pub(crate) fn reserve_verify_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|e| format!("local_runtime_verify_port_bind_failed: {e}"))?;
    listener
        .local_addr()
        .map(|addr| addr.port())
        .map_err(|e| format!("local_runtime_verify_port_query_failed: {e}"))
}

pub(crate) fn verify_log_path(prefix: &str, port: u16, suffix: &str) -> PathBuf {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    std::env::temp_dir().join(format!(
        "rushi-local-runtime-{prefix}-{port}-{now_ms}-{suffix}.log"
    ))
}

pub(crate) fn read_process_log_excerpt(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    if bytes.is_empty() {
        return None;
    }
    let start = bytes.len().saturating_sub(VERIFY_LOG_TAIL_BYTES);
    let mut text = String::from_utf8_lossy(&bytes[start..]).into_owned();
    if start > 0 {
        if let Some(index) = text.find('\n') {
            text = text[index + 1..].to_string();
        }
    }
    let lines = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    if lines.is_empty() {
        return None;
    }
    let start = lines.len().saturating_sub(6);
    Some(lines[start..].join(" | "))
}

pub(crate) fn with_process_log_detail(base: String, stderr_log: &Path, stdout_log: &Path) -> String {
    let mut parts = Vec::new();
    if let Some(stderr) = read_process_log_excerpt(stderr_log) {
        parts.push(format!("stderr={stderr}"));
    }
    if let Some(stdout) = read_process_log_excerpt(stdout_log) {
        parts.push(format!("stdout={stdout}"));
    }
    if parts.is_empty() {
        base
    } else {
        format!("{base}; {}", parts.join("; "))
    }
}

pub(crate) fn should_fail_fast_verify(err: &str) -> bool {
    err.strip_prefix("local_runtime_verify_http_")
        .and_then(|status| status.parse::<u16>().ok())
        .is_some_and(|status| status >= 500)
}

pub(crate) fn ensure_verify_not_cancelled(cancel: Option<&Arc<AtomicBool>>) -> Result<(), String> {
    if let Some(cancel) = cancel {
        ensure_not_cancelled(cancel)?;
    }
    Ok(())
}

pub(crate) fn apply_runtime_env(cmd: &mut Command, models_root: Option<&Path>) {
    if let Some(models_root) = models_root {
        let hub = models_root
            .parent()
            .and_then(crate::local_asr_model::read_hub_model_pref_for_app_root);
        crate::project::app_data_paths::apply_asr_model_env(cmd, models_root, hub.as_deref());
    }
}

pub(crate) fn probe_verify_health(
    client: &reqwest::blocking::Client,
    health_url: &str,
) -> Result<serde_json::Value, String> {
    let resp = client
        .get(health_url)
        .send()
        .map_err(|e| format!("local_runtime_verify_health_unreachable: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("local_runtime_verify_http_{}", status.as_u16()));
    }
    resp.json::<serde_json::Value>()
        .map_err(|e| format!("local_runtime_verify_json_failed: {e}"))
}

//! Sidecar install health probe. Called from `installer::run_install` inside
//! `tauri::async_runtime::spawn_blocking`, not on the main Tauri thread.

mod probe;

use probe::{
    apply_runtime_env, ensure_verify_not_cancelled, probe_verify_health, reserve_verify_port,
    should_fail_fast_verify, verify_log_path, with_process_log_detail, VERIFY_HEALTH_POLL,
    VERIFY_HEALTH_REQUEST_TIMEOUT, VERIFY_HEALTH_TIMEOUT,
};
use std::fs::{self, File};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;

pub fn verify_installed_runtime(
    exe: &Path,
    models_root: Option<&Path>,
    cancel: Option<&Arc<AtomicBool>>,
) -> Result<(), String> {
    let workdir = exe
        .parent()
        .ok_or_else(|| "local_runtime_verify_workdir_missing".to_string())?;
    ensure_verify_not_cancelled(cancel)?;
    let port = reserve_verify_port()?;
    let stdout_log = verify_log_path("verify", port, "stdout");
    let stderr_log = verify_log_path("verify", port, "stderr");
    let stdout_file = File::create(&stdout_log)
        .map_err(|e| format!("local_runtime_verify_stdout_log_failed: {e}"))?;
    let stderr_file = File::create(&stderr_log)
        .map_err(|e| format!("local_runtime_verify_stderr_log_failed: {e}"))?;
    let mut command = Command::new(exe);
    command.current_dir(workdir);
    apply_runtime_env(&mut command, models_root);
    let mut child = command
        .env("ASR_HOST", "127.0.0.1")
        .env("ASR_PORT", port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .spawn()
        .map_err(|e| format!("local_runtime_verify_spawn_failed: {e}"))?;

    let health_url = format!("http://127.0.0.1:{port}/health");
    let client = reqwest::blocking::Client::builder()
        .timeout(VERIFY_HEALTH_REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("local_runtime_verify_client_failed: {e}"))?;

    let result = (|| {
        let deadline = Instant::now() + VERIFY_HEALTH_TIMEOUT;
        let mut last_detail = "local_runtime_verify_timeout".to_string();
        while Instant::now() < deadline {
            ensure_verify_not_cancelled(cancel)?;
            if let Ok(Some(status)) = child.try_wait() {
                return Err(with_process_log_detail(
                    format!("local_runtime_verify_process_exited:{status}"),
                    &stderr_log,
                    &stdout_log,
                ));
            }

            match probe_verify_health(&client, &health_url) {
                Ok(body)
                    if body.get("service").and_then(|v| v.as_str()) == Some("rushi-asr")
                        && body.get("funasr_import_ok").and_then(|v| v.as_bool()) == Some(true)
                        && body.get("ffmpeg_ok").and_then(|v| v.as_bool()) == Some(true)
                        && body.get("funasr_ready").and_then(|v| v.as_bool()) == Some(true) =>
                {
                    if let Ok(Some(status)) = child.try_wait() {
                        return Err(with_process_log_detail(
                            format!("local_runtime_verify_process_exited_after_health:{status}"),
                            &stderr_log,
                            &stdout_log,
                        ));
                    }
                    return Ok(());
                }
                Ok(body) => {
                    last_detail = format!("local_runtime_verify_health_incomplete:{body}");
                }
                Err(err) => {
                    if should_fail_fast_verify(&err) {
                        return Err(with_process_log_detail(err, &stderr_log, &stdout_log));
                    }
                    last_detail = err;
                }
            }
            ensure_verify_not_cancelled(cancel)?;
            std::thread::sleep(VERIFY_HEALTH_POLL);
        }
        Err(with_process_log_detail(
            last_detail,
            &stderr_log,
            &stdout_log,
        ))
    })();

    let _ = child.kill();
    let _ = child.wait();
    let _ = fs::remove_file(&stdout_log);
    let _ = fs::remove_file(&stderr_log);
    result
}

#[cfg(test)]
mod tests;

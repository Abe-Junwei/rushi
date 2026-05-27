use super::ensure_not_cancelled;
use std::fs::{self, File};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

// Frozen sidecars can spend tens of seconds in the first `/health` request while
// importing FunASR and probing bundled resources. Keep the overall verification
// bounded, but allow a single health probe to wait long enough for that cold start.
const VERIFY_HEALTH_TIMEOUT: Duration = Duration::from_secs(90);
const VERIFY_HEALTH_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const VERIFY_HEALTH_POLL: Duration = Duration::from_millis(250);
const VERIFY_LOG_TAIL_BYTES: usize = 8 * 1024;

fn reserve_verify_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|e| format!("local_runtime_verify_port_bind_failed: {e}"))?;
    listener
        .local_addr()
        .map(|addr| addr.port())
        .map_err(|e| format!("local_runtime_verify_port_query_failed: {e}"))
}

fn verify_log_path(prefix: &str, port: u16, suffix: &str) -> PathBuf {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    std::env::temp_dir().join(format!(
        "rushi-local-runtime-{prefix}-{port}-{now_ms}-{suffix}.log"
    ))
}

fn read_process_log_excerpt(path: &Path) -> Option<String> {
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

fn with_process_log_detail(base: String, stderr_log: &Path, stdout_log: &Path) -> String {
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

fn should_fail_fast_verify(err: &str) -> bool {
    err.strip_prefix("local_runtime_verify_http_")
        .and_then(|status| status.parse::<u16>().ok())
        .is_some_and(|status| status >= 500)
}

fn ensure_verify_not_cancelled(cancel: Option<&Arc<AtomicBool>>) -> Result<(), String> {
    if let Some(cancel) = cancel {
        ensure_not_cancelled(cancel)?;
    }
    Ok(())
}

fn apply_runtime_env(cmd: &mut Command, models_root: Option<&Path>) {
    if let Some(models_root) = models_root {
        let _ = fs::create_dir_all(models_root);
        cmd.env("RUSHI_MODELS_ROOT", models_root);
        let modelscope = models_root.join("modelscope");
        let _ = fs::create_dir_all(&modelscope);
        cmd.env("MODELSCOPE_CACHE", &modelscope);
        let huggingface = models_root.join("huggingface");
        let _ = fs::create_dir_all(&huggingface);
        cmd.env("HF_HOME", &huggingface);
    }
}

fn probe_verify_health(client: &reqwest::blocking::Client, health_url: &str) -> Result<serde_json::Value, String> {
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
mod tests {
    use super::verify_installed_runtime;
    use crate::local_runtime::install_support::sha256_hex;
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::{Duration, Instant};
    use uuid::Uuid;

    #[test]
    fn sha256_hex_matches_known_value() {
        let temp =
            std::env::temp_dir().join(format!("rushi-local-runtime-hash-{}", Uuid::new_v4()));
        fs::write(&temp, b"abc").unwrap();
        let digest = sha256_hex(&temp).unwrap();
        assert_eq!(
            digest,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        let _ = fs::remove_file(&temp);
    }

    #[cfg(unix)]
    #[test]
    fn verify_installed_runtime_reports_early_process_exit() {
        let temp =
            std::env::temp_dir().join(format!("rushi-local-runtime-exit-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let exe = temp.join("fake-sidecar");
        fs::write(&exe, "#!/bin/sh\n>&2 echo boom-from-test\nexit 17\n").unwrap();
        let mut permissions = fs::metadata(&exe).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&exe, permissions).unwrap();

        let err = verify_installed_runtime(&exe, None, None).unwrap_err();
        assert!(err.contains("local_runtime_verify_process_exited"));
        assert!(err.contains("boom-from-test"));

        let _ = fs::remove_dir_all(&temp);
    }

    #[cfg(unix)]
    #[test]
    fn verify_installed_runtime_tolerates_slow_health_response() {
        let temp = std::env::temp_dir().join(format!(
            "rushi-local-runtime-slow-health-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&temp).unwrap();
        let exe = temp.join("fake-sidecar");
        fs::write(
            &exe,
            r#"#!/usr/bin/env python3
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return
        time.sleep(2)
        body = json.dumps({
            "status": "ok",
            "service": "rushi-asr",
            "funasr_import_ok": True,
            "ffmpeg_ok": True,
            "funasr_ready": True,
        }).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return

host = os.environ.get("ASR_HOST", "127.0.0.1")
port = int(os.environ["ASR_PORT"])
ThreadingHTTPServer((host, port), Handler).serve_forever()
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&exe).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&exe, permissions).unwrap();

        verify_installed_runtime(&exe, None, None).unwrap();

        let _ = fs::remove_dir_all(&temp);
    }

    #[cfg(unix)]
    #[test]
    fn verify_installed_runtime_fails_fast_on_health_http_500() {
        let temp =
            std::env::temp_dir().join(format!("rushi-local-runtime-http500-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let exe = temp.join("fake-sidecar");
        fs::write(
            &exe,
            r#"#!/usr/bin/env python3
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(500)
        self.end_headers()
        self.wfile.write(b"boom")

    def log_message(self, format, *args):
        return

host = os.environ.get("ASR_HOST", "127.0.0.1")
port = int(os.environ["ASR_PORT"])
ThreadingHTTPServer((host, port), Handler).serve_forever()
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&exe).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&exe, permissions).unwrap();

        let start = Instant::now();
        let err = verify_installed_runtime(&exe, None, None).unwrap_err();
        assert!(err.contains("local_runtime_verify_http_500"));
        assert!(start.elapsed().as_secs() < 10);

        let _ = fs::remove_dir_all(&temp);
    }

    #[cfg(unix)]
    #[test]
    fn verify_installed_runtime_returns_cancelled_when_flag_set() {
        let temp =
            std::env::temp_dir().join(format!("rushi-local-runtime-cancelled-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let exe = temp.join("fake-sidecar");
        fs::write(
            &exe,
            r#"#!/usr/bin/env python3
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        time.sleep(5)
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        return

host = os.environ.get("ASR_HOST", "127.0.0.1")
port = int(os.environ["ASR_PORT"])
ThreadingHTTPServer((host, port), Handler).serve_forever()
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&exe).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&exe, permissions).unwrap();

        let cancel = Arc::new(AtomicBool::new(false));
        let cancel_for_thread = cancel.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(500));
            cancel_for_thread.store(true, Ordering::SeqCst);
        });

        let err = verify_installed_runtime(&exe, None, Some(&cancel)).unwrap_err();
        assert_eq!(err, "cancelled");

        let _ = fs::remove_dir_all(&temp);
    }
}

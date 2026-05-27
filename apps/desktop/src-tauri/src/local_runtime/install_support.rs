use super::installer::update_progress;
use super::manifest::{artifact_sources, RuntimeComponent};
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use zip::ZipArchive;

// Frozen sidecars can spend tens of seconds in the first `/health` request while
// importing FunASR and probing bundled resources. Keep the overall verification
// bounded, but allow a single health probe to wait long enough for that cold start.
const VERIFY_HEALTH_TIMEOUT: Duration = Duration::from_secs(90);
const VERIFY_HEALTH_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const VERIFY_HEALTH_POLL: Duration = Duration::from_millis(250);
const MANIFEST_FETCH_TIMEOUT: Duration = Duration::from_secs(10);
const HTTP_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const ARTIFACT_REQUEST_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const MAX_EXTRACT_BYTES: u64 = 6 * 1024 * 1024 * 1024;
const MAX_EXTRACT_ENTRIES: usize = 20_000;
const VERIFY_LOG_TAIL_BYTES: usize = 8 * 1024;

fn is_http_source(source: &str) -> bool {
    source.strip_prefix("http://").is_some() || source.strip_prefix("https://").is_some()
}

fn build_manifest_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(HTTP_CONNECT_TIMEOUT)
        .timeout(MANIFEST_FETCH_TIMEOUT)
        .build()
        .map_err(|e| format!("manifest_client_build_failed: {e}"))
}

fn build_artifact_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(HTTP_CONNECT_TIMEOUT)
        .timeout(ARTIFACT_REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("artifact_client_build_failed: {e}"))
}

pub fn read_text_source(source: &str) -> Result<String, String> {
    if is_http_source(source) {
        return tauri::async_runtime::block_on(async move {
            let client = build_manifest_http_client()?;
            let resp = client
                .get(source)
                .send()
                .await
                .map_err(|e| format!("manifest_fetch_failed: {e}"))?;
            if !resp.status().is_success() {
                return Err(format!("manifest_http_{}", resp.status().as_u16()));
            }
            resp.text()
                .await
                .map_err(|e| format!("manifest_read_failed: {e}"))
        });
    }
    let path = source.strip_prefix("file://").unwrap_or(source);
    fs::read_to_string(path).map_err(|e| format!("manifest_read_failed: {e}"))
}

pub fn sha256_hex(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("open_download_failed: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0_u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("hash_read_failed: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn ensure_not_cancelled(cancel: &Arc<AtomicBool>) -> Result<(), String> {
    if cancel.load(Ordering::SeqCst) {
        Err("cancelled".into())
    } else {
        Ok(())
    }
}

pub fn disk_free_bytes(path: &Path) -> Option<u64> {
    let probe = if path.exists() {
        path.to_path_buf()
    } else {
        path.parent()?.to_path_buf()
    };

    #[cfg(unix)]
    {
        let output = std::process::Command::new("df")
            .arg("-k")
            .arg(&probe)
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let line = text.lines().last()?;
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            return None;
        }
        let available_k = parts[3].parse::<u64>().ok()?;
        Some(available_k * 1024)
    }

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

        let wide: Vec<u16> = probe
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut free = 0u64;
        unsafe {
            GetDiskFreeSpaceExW(PCWSTR(wide.as_ptr()), None, None, Some(&mut free)).ok()?;
        }
        return Some(free);
    }

    #[cfg(not(any(unix, windows)))]
    {
        let _ = probe;
        None
    }
}

fn download_to_path(
    handle: &AppHandle,
    url: &str,
    target: &Path,
    cancel: &Arc<AtomicBool>,
    version: &str,
) -> Result<(), String> {
    ensure_not_cancelled(cancel)?;
    if is_http_source(url) {
        let url_owned = url.to_string();
        let target_path = target.to_path_buf();
        let cancel_flag = cancel.clone();
        return tauri::async_runtime::block_on(async move {
            let client = build_artifact_http_client()?;
            let resp = client
                .get(&url_owned)
                .send()
                .await
                .map_err(|e| format!("artifact_fetch_failed: {e}"))?;
            if !resp.status().is_success() {
                return Err(format!("artifact_http_{}", resp.status().as_u16()));
            }
            let total = resp.content_length();
            let mut file =
                File::create(&target_path).map_err(|e| format!("artifact_create_failed: {e}"))?;
            let mut stream = resp.bytes_stream();
            let mut downloaded = 0_u64;
            while let Some(chunk) = stream.next().await {
                if cancel_flag.load(Ordering::SeqCst) {
                    return Err("cancelled".into());
                }
                let chunk = chunk.map_err(|e| format!("artifact_stream_failed: {e}"))?;
                file.write_all(&chunk)
                    .map_err(|e| format!("artifact_write_failed: {e}"))?;
                downloaded = downloaded.saturating_add(chunk.len() as u64);
                update_progress(
                    handle,
                    "downloading",
                    "正在下载本机语音识别组件…",
                    Some(version.to_string()),
                    Some(downloaded),
                    total,
                    None,
                );
            }
            Ok(())
        });
    }

    let source_path = PathBuf::from(url.strip_prefix("file://").unwrap_or(url));
    let total = fs::metadata(&source_path)
        .map_err(|e| format!("artifact_stat_failed: {e}"))?
        .len();
    let mut src = File::open(&source_path).map_err(|e| format!("artifact_open_failed: {e}"))?;
    let mut dst = File::create(target).map_err(|e| format!("artifact_create_failed: {e}"))?;
    let mut copied = 0_u64;
    let mut buf = vec![0_u8; 1024 * 1024];
    loop {
        ensure_not_cancelled(cancel)?;
        let n = src
            .read(&mut buf)
            .map_err(|e| format!("artifact_read_failed: {e}"))?;
        if n == 0 {
            break;
        }
        dst.write_all(&buf[..n])
            .map_err(|e| format!("artifact_write_failed: {e}"))?;
        copied = copied.saturating_add(n as u64);
        update_progress(
            handle,
            "downloading",
            "正在复制本机语音识别组件…",
            Some(version.to_string()),
            Some(copied),
            Some(total),
            None,
        );
    }
    Ok(())
}

pub fn download_component_artifact(
    handle: &AppHandle,
    component: &RuntimeComponent,
    target: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let sources = artifact_sources(component);
    let mut last_error = None;
    for (index, source) in sources.iter().enumerate() {
        ensure_not_cancelled(cancel)?;
        if index > 0 {
            update_progress(
                handle,
                "downloading",
                format!(
                    "主下载源失败，正在尝试镜像源 {index}/{}…",
                    sources.len() - 1
                ),
                Some(component.version.clone()),
                None,
                component.size_bytes,
                None,
            );
        }
        let _ = fs::remove_file(target);
        match download_to_path(handle, source, target, cancel, &component.version) {
            Ok(()) => return Ok(()),
            Err(err) if err == "cancelled" => return Err(err),
            Err(err) => {
                last_error = Some(format!("{source}: {err}"));
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "artifact_fetch_failed".into()))
}

pub fn extract_zip(zip_path: &Path, dest: &Path, cancel: &Arc<AtomicBool>) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("create_extract_dir_failed: {e}"))?;
    let file = File::open(zip_path).map_err(|e| format!("open_zip_failed: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("open_zip_failed: {e}"))?;
    let mut total_unpacked = 0_u64;
    for i in 0..archive.len() {
        ensure_not_cancelled(cancel)?;
        if i >= MAX_EXTRACT_ENTRIES {
            return Err("local_runtime_extract_too_many_entries".into());
        }
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("read_zip_entry_failed: {e}"))?;
        total_unpacked = total_unpacked.saturating_add(entry.size());
        if total_unpacked > MAX_EXTRACT_BYTES {
            return Err("local_runtime_extract_size_limit_exceeded".into());
        }
        let Some(rel) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            return Err("zip_path_traversal".into());
        };
        let out_path = dest.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| format!("create_dir_failed: {e}"))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create_dir_failed: {e}"))?;
        }
        let mut out = File::create(&out_path).map_err(|e| format!("create_file_failed: {e}"))?;
        std::io::copy(&mut entry, &mut out).map_err(|e| format!("extract_file_failed: {e}"))?;
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(mode));
        }
    }
    Ok(())
}

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
    let result = (|| {
        let deadline = Instant::now() + VERIFY_HEALTH_TIMEOUT;
        let client = reqwest::Client::builder()
            .timeout(VERIFY_HEALTH_REQUEST_TIMEOUT)
            .build()
            .map_err(|e| format!("local_runtime_verify_client_failed: {e}"))?;
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
            let probe = tauri::async_runtime::block_on(async {
                let resp = client
                    .get(&health_url)
                    .send()
                    .await
                    .map_err(|e| format!("local_runtime_verify_health_unreachable: {e}"))?;
                let status = resp.status();
                if !status.is_success() {
                    return Err(format!("local_runtime_verify_http_{}", status.as_u16()));
                }
                let body = resp
                    .json::<serde_json::Value>()
                    .await
                    .map_err(|e| format!("local_runtime_verify_json_failed: {e}"))?;
                Ok(body)
            });

            match probe {
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
    use super::{sha256_hex, verify_installed_runtime};
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

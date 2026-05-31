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
    let temp = std::env::temp_dir().join(format!("rushi-local-runtime-hash-{}", Uuid::new_v4()));
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
    let temp = std::env::temp_dir().join(format!("rushi-local-runtime-exit-{}", Uuid::new_v4()));
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
    let temp = std::env::temp_dir().join(format!("rushi-local-runtime-http500-{}", Uuid::new_v4()));
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

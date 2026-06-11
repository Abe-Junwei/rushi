//! C-class auto rollback integration tests (revalidate path).

#[cfg(unix)]
use super::run::{run_revalidate, RevalidateOutcome};
#[cfg(unix)]
use crate::local_runtime::integrity::{read_marker, version_dir, write_marker_with_previous};
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use uuid::Uuid;

#[cfg(unix)]
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

const EXE_RELPATH: &str = "rushi-asr-sidecar/rushi-asr-sidecar";

#[cfg(unix)]
const OK_HEALTH_SCRIPT: &str = r#"#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return
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
"#;

#[cfg(unix)]
const HTTP500_SCRIPT: &str = r#"#!/usr/bin/env python3
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
"#;

#[cfg(unix)]
fn write_fake_sidecar(version_root: &Path, script: &str) -> PathBuf {
    let sidecar_dir = version_root.join("rushi-asr-sidecar");
    fs::create_dir_all(&sidecar_dir).expect("create sidecar dir");
    let exe = sidecar_dir.join("rushi-asr-sidecar");
    fs::write(&exe, script).expect("write fake sidecar");
    let mut permissions = fs::metadata(&exe).expect("metadata").permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&exe, permissions).expect("chmod fake sidecar");
    exe
}

/// Simulates post-upgrade health failure on current (0.2.0) and auto rollback to previous (0.1.0).
#[cfg(unix)]
#[test]
fn c_class_auto_rollback_revalidate_restores_previous() {
    let app_root = std::env::temp_dir().join(format!("rushi-c-rollback-{}", Uuid::new_v4()));
    let _ = std::fs::remove_dir_all(&app_root);
    std::fs::create_dir_all(&app_root).expect("create app_root");
    let cancel = Arc::new(AtomicBool::new(false));

    write_fake_sidecar(&version_dir(&app_root, "0.1.0"), OK_HEALTH_SCRIPT);
    write_fake_sidecar(&version_dir(&app_root, "0.2.0"), HTTP500_SCRIPT);
    write_marker_with_previous(
        &app_root,
        "0.2.0",
        EXE_RELPATH,
        Some(("0.1.0", EXE_RELPATH)),
        Some("ready"),
    )
    .expect("write marker");

    let outcome = run_revalidate(&app_root, &cancel).expect("revalidate should auto rollback");
    match outcome {
        RevalidateOutcome::AutoRolledBack(version) => assert_eq!(version, "0.1.0"),
        other => panic!("expected AutoRolledBack, got {other:?}"),
    }

    let marker = read_marker(&app_root).expect("marker");
    assert_eq!(marker.version, "0.1.0");
    assert_eq!(marker.previous_version.as_deref(), Some("0.2.0"));
    let _ = std::fs::remove_dir_all(&app_root);
}

#[cfg(not(unix))]
#[test]
fn c_class_auto_rollback_revalidate_restores_previous() {
    eprintln!("SKIP c_class_auto_rollback_revalidate_restores_previous on non-unix");
}

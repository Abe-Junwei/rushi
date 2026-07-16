use super::bundled::BundledAsrLaunchReport;
use super::candidates::bundled_sidecar_candidates_from_roots;
use super::probe::{
    health_declares_local_token_required, is_rushi_asr_health_json, loopback_port_accepts_tcp,
    loopback_root_declares_model_catalog, loopback_root_declares_punc_prepare,
    loopback_root_declares_transcribe_async,
};
use crate::bundled_asr_assets::candidate_resource_roots_from_parts;
use serde_json::json;
use std::fs;
use std::net::TcpListener;
use std::path::Path;

#[test]
fn recognizes_valid_health_json() {
    let v = json!({
        "service": "rushi-asr",
        "status": "ok",
        "transcription_mode": "funasr"
    });
    assert!(is_rushi_asr_health_json(&v));
}

#[test]
fn rejects_wrong_service() {
    let v = json!({
        "service": "other-service",
        "status": "ok"
    });
    assert!(!is_rushi_asr_health_json(&v));
}

#[test]
fn rejects_non_ok_status() {
    let v = json!({
        "service": "rushi-asr",
        "status": "loading"
    });
    assert!(!is_rushi_asr_health_json(&v));
}

#[test]
fn rejects_missing_fields() {
    let v = json!({ "status": "ok" });
    assert!(!is_rushi_asr_health_json(&v));

    let v = json!({ "service": "rushi-asr" });
    assert!(!is_rushi_asr_health_json(&v));
}

#[test]
fn health_local_token_required_flag() {
    let v = json!({
        "service": "rushi-asr",
        "status": "ok",
        "local_token_required": true
    });
    assert!(health_declares_local_token_required(&v));
    let v = json!({
        "service": "rushi-asr",
        "status": "ok",
        "local_token_required": false
    });
    assert!(!health_declares_local_token_required(&v));
}

#[test]
fn launch_report_default_is_not_attempted() {
    let report = BundledAsrLaunchReport::default();
    assert!(!report.attempted);
    assert!(!report.success);
    assert!(report.detail.is_none());
}

#[test]
fn candidate_resource_roots_include_dev_and_manifest_paths() {
    let resource_dir = Some(std::path::PathBuf::from("/tmp/app/Contents/Resources"));
    let manifest_dir = std::path::PathBuf::from("/repo/apps/desktop/src-tauri");
    let roots = candidate_resource_roots_from_parts(resource_dir, &manifest_dir);
    assert!(roots.contains(&std::path::PathBuf::from("/tmp/app/Contents/Resources")));
    assert!(roots.contains(&std::path::PathBuf::from(
        "/tmp/app/Contents/Resources/resources"
    )));
    assert!(roots.contains(&std::path::PathBuf::from(
        "/repo/apps/desktop/src-tauri/target/debug/resources"
    )));
    assert!(roots.contains(&std::path::PathBuf::from(
        "/repo/apps/desktop/target/debug/resources"
    )));
    assert!(roots.contains(&std::path::PathBuf::from(
        "/repo/apps/desktop/src-tauri/resources"
    )));
}

#[test]
fn candidate_resource_roots_deduplicate_existing_resources_dir() {
    let resource_dir = Some(std::path::PathBuf::from(
        "/repo/apps/desktop/src-tauri/resources",
    ));
    let manifest_dir = std::path::PathBuf::from("/repo/apps/desktop/src-tauri");
    let roots = candidate_resource_roots_from_parts(resource_dir, &manifest_dir);
    let count = roots
        .iter()
        .filter(|p| p.as_path() == Path::new("/repo/apps/desktop/src-tauri/resources"))
        .count();
    assert_eq!(count, 1);
}

#[test]
fn bundled_candidates_from_roots_deduplicate_same_executable() {
    let root = std::env::temp_dir().join(format!("rushi-asr-sidecar-test-{}", std::process::id()));
    #[cfg(target_os = "windows")]
    let exe = root
        .join("bundled-asr")
        .join("rushi-asr-sidecar")
        .join("rushi-asr-sidecar.exe");
    #[cfg(not(target_os = "windows"))]
    let exe = root
        .join("bundled-asr")
        .join("rushi-asr-sidecar")
        .join("rushi-asr-sidecar");
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, vec![0_u8; 2048]).unwrap();
    let roots = vec![root.clone(), root.clone()];
    let candidates = bundled_sidecar_candidates_from_roots(&roots);
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0], exe);
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn bundled_candidates_cpu_only_when_no_cuda_onedir() {
    let root = std::env::temp_dir().join(format!(
        "rushi-asr-sidecar-cpu-only-{}",
        std::process::id()
    ));
    #[cfg(target_os = "windows")]
    let exe = root
        .join("bundled-asr")
        .join("rushi-asr-sidecar")
        .join("rushi-asr-sidecar.exe");
    #[cfg(not(target_os = "windows"))]
    let exe = root
        .join("bundled-asr")
        .join("rushi-asr-sidecar")
        .join("rushi-asr-sidecar");
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, vec![0_u8; 2048]).unwrap();
    let candidates = bundled_sidecar_candidates_from_roots(&[root.clone()]);
    assert_eq!(candidates, vec![exe]);
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn nvidia_probe_is_false_on_non_windows() {
    #[cfg(not(target_os = "windows"))]
    {
        assert!(!super::candidates::windows_nvidia_probe_ok());
    }
}

#[test]
fn detects_transcribe_async_in_loopback_root() {
    let fresh = json!({
        "transcribe_async": "POST /v1/transcribe/async + GET /v1/transcribe/status",
    });
    assert!(loopback_root_declares_transcribe_async(&fresh));

    let stale = json!({ "transcribe": "POST /v1/transcribe" });
    assert!(!loopback_root_declares_transcribe_async(&stale));
}

#[test]
fn loopback_root_declares_model_catalog_and_punc_prepare() {
    let root = json!({
        "model_catalog": "GET /v1/models/catalog",
        "prepare_cancel": "POST /v1/models/prepare-cancel",
    });
    assert!(loopback_root_declares_model_catalog(&root));
    assert!(loopback_root_declares_punc_prepare(&root));
}

#[test]
fn prepare_status_json_active_running_honors_stale_flag() {
    use super::probe::prepare_status_json_is_active_running;

    assert!(prepare_status_json_is_active_running(
        &json!({ "phase": "running" })
    ));
    assert!(!prepare_status_json_is_active_running(
        &json!({ "phase": "running", "stale": true })
    ));
    assert!(!prepare_status_json_is_active_running(
        &json!({ "phase": "idle" })
    ));
}

#[test]
fn loopback_port_accepts_tcp_detects_bound_listener() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let port = listener.local_addr().unwrap().port();
    assert!(loopback_port_accepts_tcp(port));
    drop(listener);
    assert!(!loopback_port_accepts_tcp(port));
}

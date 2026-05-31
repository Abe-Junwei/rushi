use crate::local_runtime::integrity::inspect::inspect_installed_runtime;
use crate::local_runtime::integrity::marker::{
    clear_installed_runtime, mark_runtime_corrupt, read_marker, write_marker,
    write_marker_with_previous,
};
use crate::local_runtime::integrity::paths::{local_runtime_root, runtime_root_exists};
use crate::local_runtime::integrity::types::InstalledRuntimeStatus;
use std::fs;
use uuid::Uuid;

fn write_runtime_payload(runtime_dir: &std::path::Path) {
    let internal = runtime_dir.join("_internal");
    fs::create_dir_all(internal.join("funasr")).unwrap();
    fs::write(internal.join("funasr").join("version.txt"), b"1.0.0").unwrap();
    #[cfg(target_os = "windows")]
    fs::write(internal.join("ffmpeg.exe"), b"ffmpeg").unwrap();
    #[cfg(not(target_os = "windows"))]
    fs::write(internal.join("ffmpeg"), b"ffmpeg").unwrap();
    #[cfg(target_os = "windows")]
    fs::write(internal.join("ffprobe.exe"), b"ffprobe").unwrap();
    #[cfg(not(target_os = "windows"))]
    fs::write(internal.join("ffprobe"), b"ffprobe").unwrap();
}

fn temp_root() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("rushi-local-runtime-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[cfg(target_os = "windows")]
fn test_exe_relpath() -> &'static str {
    "rushi-asr-sidecar/rushi-asr-sidecar.exe"
}

#[cfg(not(target_os = "windows"))]
fn test_exe_relpath() -> &'static str {
    "rushi-asr-sidecar/rushi-asr-sidecar"
}

#[test]
fn inspect_runtime_reports_missing_by_default() {
    let root = temp_root();
    let info = inspect_installed_runtime(&root);
    assert_eq!(info.status, InstalledRuntimeStatus::Missing);
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn inspect_runtime_reports_installed_when_marker_and_exe_exist() {
    let root = temp_root();
    let exe_relpath = test_exe_relpath();
    let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, vec![0_u8; 2048]).unwrap();
    write_runtime_payload(exe.parent().unwrap());
    write_marker(&root, "0.1.0", exe_relpath).unwrap();
    let info = inspect_installed_runtime(&root);
    assert_eq!(info.status, InstalledRuntimeStatus::Installed);
    let _ = fs::remove_dir_all(&root);
}

#[cfg(not(target_os = "windows"))]
#[test]
fn inspect_runtime_reports_corrupt_when_funasr_payload_missing() {
    let root = temp_root();
    let exe_relpath = test_exe_relpath();
    let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, vec![0_u8; 2048]).unwrap();
    let internal = exe.parent().unwrap().join("_internal");
    fs::create_dir_all(&internal).unwrap();
    #[cfg(target_os = "windows")]
    fs::write(internal.join("ffmpeg.exe"), b"ffmpeg").unwrap();
    #[cfg(not(target_os = "windows"))]
    fs::write(internal.join("ffmpeg"), b"ffmpeg").unwrap();
    #[cfg(target_os = "windows")]
    fs::write(internal.join("ffprobe.exe"), b"ffprobe").unwrap();
    #[cfg(not(target_os = "windows"))]
    fs::write(internal.join("ffprobe"), b"ffprobe").unwrap();
    write_marker(&root, "0.1.0", exe_relpath).unwrap();

    let info = inspect_installed_runtime(&root);
    assert_eq!(info.status, InstalledRuntimeStatus::Corrupt);
    assert!(info.detail.unwrap_or_default().contains("FunASR"));
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn inspect_runtime_reports_corrupt_when_marker_marked_failed_verify() {
    let root = temp_root();
    let exe_relpath = test_exe_relpath();
    let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, vec![0_u8; 2048]).unwrap();
    write_runtime_payload(exe.parent().unwrap());
    write_marker(&root, "0.1.0", exe_relpath).unwrap();
    let marker = read_marker(&root).unwrap();
    mark_runtime_corrupt(
        &root,
        &marker,
        Some("local_runtime_verify_health_incomplete"),
        Some("verifying"),
    )
    .unwrap();

    let info = inspect_installed_runtime(&root);
    assert_eq!(info.status, InstalledRuntimeStatus::Corrupt);
    assert!(info
        .detail
        .unwrap_or_default()
        .contains("local_runtime_verify_health_incomplete"));
    assert_eq!(info.last_install_phase.as_deref(), Some("verifying"));
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn inspect_runtime_exposes_previous_version_from_marker() {
    let root = temp_root();
    let exe_relpath = test_exe_relpath();
    let exe = local_runtime_root(&root).join("0.2.0").join(exe_relpath);
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, vec![0_u8; 2048]).unwrap();
    write_runtime_payload(exe.parent().unwrap());
    write_marker_with_previous(
        &root,
        "0.2.0",
        exe_relpath,
        Some(("0.1.0", exe_relpath)),
        Some("ready"),
    )
    .unwrap();

    let info = inspect_installed_runtime(&root);
    assert_eq!(info.status, InstalledRuntimeStatus::Installed);
    assert_eq!(info.previous_version.as_deref(), Some("0.1.0"));
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn clear_installed_runtime_removes_runtime_root() {
    let root = temp_root();
    let exe_relpath = test_exe_relpath();
    let exe = local_runtime_root(&root).join("0.1.0").join(exe_relpath);
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, vec![0_u8; 2048]).unwrap();
    write_runtime_payload(exe.parent().unwrap());
    write_marker(&root, "0.1.0", exe_relpath).unwrap();

    clear_installed_runtime(&root).unwrap();
    assert!(!local_runtime_root(&root).exists());
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn inspect_runtime_reports_corrupt_when_marker_missing_but_root_exists() {
    let root = temp_root();
    fs::create_dir_all(local_runtime_root(&root).join("orphaned")).unwrap();
    let info = inspect_installed_runtime(&root);
    assert_eq!(info.status, InstalledRuntimeStatus::Corrupt);
    assert!(info.detail.unwrap_or_default().contains("marker 缺失"));
    assert!(runtime_root_exists(&root));
    let _ = fs::remove_dir_all(&root);
}

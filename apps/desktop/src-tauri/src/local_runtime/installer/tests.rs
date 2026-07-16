use super::progress::{
    cuda_install_busy, install_phase_running, refuse_cuda_start_reason, refuse_lrc_start_reason,
    rewrite_progress_message_for_cuda,
};
use super::run::previous_marker_for_install;
use crate::local_runtime::integrity::InstalledRuntimeMarker;

#[test]
fn install_phase_running_treats_verifying_as_busy() {
    assert!(install_phase_running("downloading"));
    assert!(install_phase_running("installing"));
    assert!(install_phase_running("verifying"));
    assert!(!install_phase_running("idle"));
    assert!(!install_phase_running("installed"));
    assert!(!install_phase_running("error"));
    assert!(!install_phase_running("cancelled"));
}

#[test]
fn cuda_install_busy_requires_cancel_handle_and_running_phase() {
    assert!(cuda_install_busy(true, "downloading"));
    assert!(cuda_install_busy(true, "installing"));
    assert!(cuda_install_busy(true, "verifying"));
    assert!(!cuda_install_busy(false, "downloading"));
    assert!(!cuda_install_busy(true, "idle"));
    assert!(!cuda_install_busy(true, "installed"));
    assert!(!cuda_install_busy(true, "error"));
    assert!(!cuda_install_busy(true, "cancelled"));
}

#[test]
fn refuse_lrc_start_when_cuda_busy() {
    assert_eq!(
        refuse_lrc_start_reason(true),
        Some("cuda_download_running")
    );
    assert_eq!(refuse_lrc_start_reason(false), None);
}

#[test]
fn refuse_cuda_start_when_lrc_busy() {
    assert_eq!(
        refuse_cuda_start_reason(true),
        Some("lrc_download_running")
    );
    assert_eq!(refuse_cuda_start_reason(false), None);
}

#[test]
fn mutual_exclusion_reasons_are_distinct() {
    // Both installers share download/progress helpers; reasons must stay distinct
    // so frontend can show the correct "wait for the other" copy.
    assert_ne!(
        refuse_lrc_start_reason(true),
        refuse_cuda_start_reason(true)
    );
}

#[test]
fn rewrite_progress_message_for_cuda_rewrites_lrc_copy() {
    assert_eq!(
        rewrite_progress_message_for_cuda("正在下载本机语音识别组件…"),
        "正在下载 GPU 加速组件…"
    );
    assert_eq!(
        rewrite_progress_message_for_cuda("正在断点续传语音识别组件…"),
        "正在断点续传 GPU 加速组件…"
    );
    assert_eq!(
        rewrite_progress_message_for_cuda("主下载源失败，正在尝试镜像源"),
        "主下载源失败，正在尝试镜像源"
    );
}

#[test]
fn previous_marker_for_install_preserves_previous_on_same_version_reinstall() {
    let marker = InstalledRuntimeMarker {
        version: "0.2.0".into(),
        exe_relpath: "rushi-asr-sidecar/rushi-asr-sidecar".into(),
        verify_state: Some("ok".into()),
        previous_version: Some("0.1.0".into()),
        previous_exe_relpath: Some("rushi-asr-sidecar/rushi-asr-sidecar".into()),
        last_verify_error: None,
        last_install_phase: Some("ready".into()),
    };

    let previous = previous_marker_for_install(Some(&marker), "0.2.0");
    assert_eq!(
        previous,
        Some(("0.1.0", "rushi-asr-sidecar/rushi-asr-sidecar"))
    );
}

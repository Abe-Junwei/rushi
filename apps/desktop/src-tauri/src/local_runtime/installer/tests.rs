use super::progress::install_phase_running;
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

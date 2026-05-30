use super::helpers::is_transient_verify_error;
use super::run::run_restore_previous;
use crate::local_runtime::integrity::{read_marker, InstalledRuntimeMarker};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub(crate) fn should_attempt_auto_health_rollback(
    verify_error: &str,
    marker: &InstalledRuntimeMarker,
    failed_version: Option<&str>,
) -> bool {
    if verify_error == "cancelled" || is_transient_verify_error(verify_error) {
        return false;
    }
    if !verify_error.starts_with("local_runtime_verify_") {
        return false;
    }
    let Some(previous_version) = marker.previous_version.as_deref() else {
        return false;
    };
    if previous_version.is_empty() || marker.previous_exe_relpath.is_none() {
        return false;
    }
    failed_version.is_some_and(|version| version == marker.version)
}

pub(crate) fn run_auto_health_rollback(
    app_root: &Path,
    cancel: &Arc<AtomicBool>,
    verify_error: &str,
    failed_version: Option<&str>,
) -> Result<String, String> {
    let marker = read_marker(app_root)?;
    if !should_attempt_auto_health_rollback(verify_error, &marker, failed_version) {
        return Err("local_runtime_auto_rollback_skipped".into());
    }
    run_restore_previous(app_root, cancel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::local_runtime::integrity::InstalledRuntimeMarker;

    fn marker_with_previous() -> InstalledRuntimeMarker {
        InstalledRuntimeMarker {
            version: "0.2.0".into(),
            exe_relpath: "rushi-asr-sidecar/rushi-asr-sidecar".into(),
            verify_state: Some("ok".into()),
            previous_version: Some("0.1.0".into()),
            previous_exe_relpath: Some("rushi-asr-sidecar/rushi-asr-sidecar".into()),
            last_verify_error: None,
            last_install_phase: Some("ready".into()),
        }
    }

    #[test]
    fn auto_rollback_requires_verify_failure_on_current_version() {
        let marker = marker_with_previous();
        assert!(should_attempt_auto_health_rollback(
            "local_runtime_verify_http_500",
            &marker,
            Some("0.2.0"),
        ));
        assert!(!should_attempt_auto_health_rollback(
            "local_runtime_verify_http_500",
            &marker,
            Some("0.1.0"),
        ));
    }

    #[test]
    fn auto_rollback_skips_transient_and_non_verify_errors() {
        let marker = marker_with_previous();
        assert!(!should_attempt_auto_health_rollback(
            "local_runtime_verify_health_unreachable:timeout",
            &marker,
            Some("0.2.0"),
        ));
        assert!(!should_attempt_auto_health_rollback(
            "local_runtime_sha256_mismatch",
            &marker,
            Some("0.2.0"),
        ));
    }
}

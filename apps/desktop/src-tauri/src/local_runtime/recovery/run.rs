use super::auto_rollback::run_auto_health_rollback;
use super::helpers::{is_transient_verify_error, should_persist_revalidate_corrupt};
use crate::local_runtime::install_support::verify_installed_runtime;
use crate::local_runtime::integrity::{
    mark_runtime_corrupt, read_marker, version_dir, write_marker_with_previous,
};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub(crate) enum RevalidateOutcome {
    Verified(String),
    AutoRolledBack(String),
}

pub(crate) fn run_revalidate(
    app_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<RevalidateOutcome, String> {
    let marker =
        read_marker(app_root).map_err(|_| "local_runtime_not_revalidatable".to_string())?;
    let install_dir = version_dir(app_root, &marker.version);
    let installed_exe = install_dir.join(&marker.exe_relpath);
    if !installed_exe.is_file() {
        return Err("local_runtime_executable_missing".into());
    }
    let models_root = crate::project::models_root_for_app_data_root(app_root);
    let verify = |cancel: &Arc<AtomicBool>| {
        verify_installed_runtime(&installed_exe, Some(&models_root), Some(cancel))
    };
    match verify(cancel).or_else(|err| {
        if is_transient_verify_error(&err) && err != "cancelled" {
            verify(cancel)
        } else {
            Err(err)
        }
    }) {
        Ok(()) => {
            write_marker_with_previous(
                app_root,
                &marker.version,
                &marker.exe_relpath,
                marker
                    .previous_version
                    .as_deref()
                    .zip(marker.previous_exe_relpath.as_deref()),
                Some("ready"),
            )?;
            Ok(RevalidateOutcome::Verified(marker.version))
        }
        Err(err) => {
            if let Ok(restored) =
                run_auto_health_rollback(app_root, cancel, &err, Some(marker.version.as_str()))
            {
                return Ok(RevalidateOutcome::AutoRolledBack(restored));
            }
            if should_persist_revalidate_corrupt(&err) {
                let _ = mark_runtime_corrupt(app_root, &marker, Some(&err), Some("verifying"));
            }
            Err(err)
        }
    }
}

pub(crate) fn run_restore_previous(
    app_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<String, String> {
    let marker = read_marker(app_root).map_err(|_| "local_runtime_not_restorable".to_string())?;
    let Some(previous_version) = marker.previous_version.as_deref() else {
        return Err("local_runtime_no_previous".into());
    };
    let Some(previous_exe_relpath) = marker.previous_exe_relpath.as_deref() else {
        return Err("local_runtime_no_previous".into());
    };
    let previous_dir = version_dir(app_root, previous_version);
    let previous_exe = previous_dir.join(previous_exe_relpath);
    if !previous_exe.is_file() {
        return Err("local_runtime_previous_missing".into());
    }
    let models_root = crate::project::models_root_for_app_data_root(app_root);
    verify_installed_runtime(&previous_exe, Some(&models_root), Some(cancel))?;
    write_marker_with_previous(
        app_root,
        previous_version,
        previous_exe_relpath,
        Some((marker.version.as_str(), marker.exe_relpath.as_str())),
        Some("ready"),
    )?;
    Ok(previous_version.to_string())
}

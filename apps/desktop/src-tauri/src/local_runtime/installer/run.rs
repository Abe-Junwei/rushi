use super::progress::{append_runtime_log_line, update_progress};
use crate::local_runtime::catalog::load_configured_manifest;
use crate::local_runtime::install_support::{
    artifact_download_paths, clear_resume_artifacts, clear_resume_meta, disk_free_bytes,
    download_component_artifact, ensure_not_cancelled, extract_zip, sha256_hex,
    verify_installed_runtime,
};
use crate::local_runtime::integrity::{
    clear_installed_runtime, gc_stale_version_dirs, inspect_installed_runtime, local_runtime_root,
    read_marker, version_dir, write_marker_with_previous, InstalledRuntimeMarker,
    InstalledRuntimeStatus,
};
use crate::local_runtime::manifest::{
    current_platform_key, is_shell_version_compatible, select_asr_sidecar_component,
};
use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::AppHandle;
use uuid::Uuid;

const INSTALL_DISK_HEADROOM_BYTES: u64 = 512 * 1024 * 1024;

fn required_install_bytes(component_size: Option<u64>) -> Option<u64> {
    component_size.map(|size| {
        size.saturating_mul(3)
            .saturating_add(INSTALL_DISK_HEADROOM_BYTES)
    })
}

fn ensure_install_disk_budget(app_root: &Path, artifact_size: Option<u64>) -> Result<(), String> {
    let Some(required_bytes) = required_install_bytes(artifact_size) else {
        return Ok(());
    };
    let Some(free_bytes) = disk_free_bytes(&local_runtime_root(app_root)) else {
        return Ok(());
    };
    if free_bytes < required_bytes {
        return Err(format!(
            "local_runtime_disk_space_low:{free_bytes}:{required_bytes}"
        ));
    }
    Ok(())
}

pub(super) fn previous_marker_for_install<'a>(
    existing_marker: Option<&'a InstalledRuntimeMarker>,
    installing_version: &str,
) -> Option<(&'a str, &'a str)> {
    existing_marker.and_then(|marker| {
        if marker.version != installing_version {
            Some((marker.version.as_str(), marker.exe_relpath.as_str()))
        } else {
            marker
                .previous_version
                .as_deref()
                .zip(marker.previous_exe_relpath.as_deref())
        }
    })
}

pub(super) fn run_install(
    handle: &AppHandle,
    app_root: &Path,
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    update_progress(
        handle,
        "downloading",
        "正在读取本机语音识别组件 manifest…",
        None,
        None,
        None,
        None,
    );
    let loaded = load_configured_manifest()?;
    let signature_key_id = loaded.signature_key_id.clone();
    let manifest_source = loaded.source.clone();
    let manifest = loaded.manifest;
    let platform = current_platform_key();
    let component = select_asr_sidecar_component(&manifest, &platform)
        .ok_or_else(|| format!("local_runtime_component_missing:{platform}"))?;
    if let Some(min_shell_version) = component.min_shell_version.as_deref() {
        if !is_shell_version_compatible(env!("CARGO_PKG_VERSION"), min_shell_version) {
            return Err(format!(
                "local_runtime_shell_version_incompatible:{}:{}",
                env!("CARGO_PKG_VERSION"),
                min_shell_version
            ));
        }
    }
    let root = local_runtime_root(app_root);
    fs::create_dir_all(&root).map_err(|e| format!("create_local_runtime_root_failed: {e}"))?;
    ensure_install_disk_budget(app_root, component.size_bytes)?;
    let (tmp_zip, tmp_meta) = artifact_download_paths(app_root, component);
    let staging = root.join(format!("staging-{}", uuid::Uuid::new_v4()));
    let install_dir = version_dir(app_root, &component.version);
    let existing_marker = read_marker(app_root).ok().filter(|_| {
        inspect_installed_runtime(app_root).status == InstalledRuntimeStatus::Installed
    });
    download_component_artifact(handle, app_root, component, &tmp_zip, &cancel)?;
    ensure_not_cancelled(&cancel)?;
    let actual_sha = sha256_hex(&tmp_zip)?;
    if !component.sha256.trim().is_empty() && actual_sha != component.sha256.to_lowercase() {
        return Err("local_runtime_sha256_mismatch".into());
    }
    // Keep the downloaded .zip.part for extract; only drop resume meta.
    clear_resume_meta(&tmp_meta);
    update_progress(
        handle,
        "installing",
        "正在解压并校验本机语音识别组件…",
        Some(component.version.clone()),
        None,
        None,
        None,
    );
    let _ = fs::remove_dir_all(&staging);
    extract_zip(&tmp_zip, &staging, &cancel)?;
    clear_resume_artifacts(&tmp_zip, &tmp_meta);
    let staged_exe = staging.join(&component.exe_relpath);
    if !staged_exe.is_file() {
        let _ = fs::remove_dir_all(&staging);
        return Err("local_runtime_executable_missing".into());
    }
    update_progress(
        handle,
        "verifying",
        "正在验证本机语音识别组件可用性…",
        Some(component.version.clone()),
        None,
        None,
        None,
    );
    let models_root = crate::project::models_root_for_app_data_root(app_root);
    if let Err(err) = verify_installed_runtime(&staged_exe, Some(&models_root), Some(&cancel)) {
        let _ = fs::remove_dir_all(&staging);
        return Err(err);
    }
    let backup_dir = if install_dir.exists() {
        let backup = root.join(format!("rollback-{}", Uuid::new_v4()));
        fs::rename(&install_dir, &backup).map_err(|e| format!("backup_runtime_failed: {e}"))?;
        Some(backup)
    } else {
        None
    };
    if let Err(err) = fs::rename(&staging, &install_dir) {
        if let Some(backup) = &backup_dir {
            let _ = fs::rename(backup, &install_dir);
        }
        return Err(format!("promote_runtime_failed: {err}"));
    }
    let installed_exe = install_dir.join(&component.exe_relpath);
    if !installed_exe.is_file() {
        let _ = fs::remove_dir_all(&install_dir);
        if let Some(backup) = &backup_dir {
            let _ = fs::rename(backup, &install_dir);
        }
        return Err("local_runtime_executable_missing".into());
    }
    if let Err(err) = write_marker_with_previous(
        app_root,
        &component.version,
        &component.exe_relpath,
        previous_marker_for_install(existing_marker.as_ref(), &component.version),
        Some("ready"),
    ) {
        let _ = fs::remove_dir_all(&install_dir);
        if let Some(backup) = &backup_dir {
            let _ = fs::rename(backup, &install_dir);
        }
        return Err(err);
    }
    let info = inspect_installed_runtime(app_root);
    match info.status {
        InstalledRuntimeStatus::Installed => {
            if let Some(backup) = backup_dir {
                let _ = fs::remove_dir_all(backup);
            }
            let _ = gc_stale_version_dirs(app_root);
            update_progress(
                handle,
                "installed",
                "本机语音识别组件已安装完成。",
                Some(component.version.clone()),
                None,
                None,
                None,
            );
            append_runtime_log_line(
                handle,
                &format!(
                    "INFO local_runtime_installed version={} signature_key={} source={}",
                    component.version, signature_key_id, manifest_source
                ),
            );
            Ok(())
        }
        _ => {
            if let Some(backup) = &backup_dir {
                let _ = fs::remove_dir_all(&install_dir);
                let _ = fs::rename(backup, &install_dir);
            }
            let detail = info
                .detail
                .clone()
                .unwrap_or_else(|| "local_runtime_install_corrupt".into());
            if let Some(prev) = existing_marker.as_ref() {
                let _ = write_marker_with_previous(
                    app_root,
                    &prev.version,
                    &prev.exe_relpath,
                    prev.previous_version
                        .as_deref()
                        .zip(prev.previous_exe_relpath.as_deref()),
                    Some("ready"),
                );
            } else {
                let _ = clear_installed_runtime(app_root);
            }
            Err(detail)
        }
    }
}

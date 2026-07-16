use super::paths::{
    cuda_downloads_dir, cuda_sidecar_install_dir, cuda_staging_root, write_cuda_installed_version,
};
use super::progress::{append_cuda_log_line, update_cuda_progress};
use crate::local_runtime::catalog::load_configured_manifest;
use crate::local_runtime::install_support::{
    artifact_download_paths_in, clear_resume_artifacts, clear_resume_meta, disk_free_bytes,
    download_component_artifact_in, ensure_not_cancelled, extract_zip, sha256_hex,
    verify_installed_runtime,
};
use crate::local_runtime::manifest::{
    current_platform_key, is_shell_version_compatible, select_asr_sidecar_cuda_component,
};
use std::fs;
use std::path::{Path, PathBuf};
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

fn ensure_cuda_disk_budget(app_root: &Path, artifact_size: Option<u64>) -> Result<(), String> {
    let Some(required_bytes) = required_install_bytes(artifact_size) else {
        return Ok(());
    };
    let probe_root = cuda_sidecar_install_dir(app_root);
    let Some(free_bytes) = disk_free_bytes(probe_root.parent().unwrap_or(app_root)) else {
        return Ok(());
    };
    if free_bytes < required_bytes {
        return Err(format!(
            "asr_cuda_disk_space_low:{free_bytes}:{required_bytes}"
        ));
    }
    Ok(())
}

/// Prefer zip root `rushi-asr-sidecar-cuda/…`; also accept flat onedir contents.
fn resolve_staged_cuda_exe(staging: &Path, exe_relpath: &str) -> Option<PathBuf> {
    let direct = staging.join(exe_relpath);
    if direct.is_file() {
        return Some(direct);
    }
    let nested = staging
        .join("rushi-asr-sidecar-cuda")
        .join("rushi-asr-sidecar-cuda.exe");
    if nested.is_file() {
        return Some(nested);
    }
    let flat = staging.join("rushi-asr-sidecar-cuda.exe");
    if flat.is_file() {
        return Some(flat);
    }
    None
}

fn promote_cuda_onedir(install_dir: &Path, staged_exe: &Path) -> Result<(), String> {
    let onedir_root = staged_exe
        .parent()
        .ok_or_else(|| "asr_cuda_executable_missing".to_string())?;
    if install_dir.exists() {
        fs::remove_dir_all(install_dir).map_err(|e| format!("asr_cuda_remove_old_failed: {e}"))?;
    }
    if let Some(parent) = install_dir.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("asr_cuda_create_parent_failed: {e}"))?;
    }
    fs::rename(onedir_root, install_dir).map_err(|e| format!("asr_cuda_promote_failed: {e}"))
}

pub(super) fn run_cuda_install(
    handle: &AppHandle,
    app_root: &Path,
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    update_cuda_progress(
        handle,
        "downloading",
        "正在读取 GPU 加速组件 manifest…",
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
    let component = select_asr_sidecar_cuda_component(&manifest, &platform)
        .ok_or_else(|| format!("asr_cuda_component_missing:{platform}"))?;
    if let Some(min_shell_version) = component.min_shell_version.as_deref() {
        if !is_shell_version_compatible(env!("CARGO_PKG_VERSION"), min_shell_version) {
            return Err(format!(
                "asr_cuda_shell_version_incompatible:{}:{}",
                env!("CARGO_PKG_VERSION"),
                min_shell_version
            ));
        }
    }
    ensure_cuda_disk_budget(app_root, component.size_bytes)?;

    let downloads = cuda_downloads_dir(app_root);
    fs::create_dir_all(&downloads).map_err(|e| format!("asr_cuda_downloads_dir_failed: {e}"))?;
    let (tmp_zip, tmp_meta) = artifact_download_paths_in(&downloads, component);
    download_component_artifact_in(handle, app_root, &downloads, component, &tmp_zip, &cancel)?;
    ensure_not_cancelled(&cancel)?;
    let actual_sha = sha256_hex(&tmp_zip)?;
    if !component.sha256.trim().is_empty() && actual_sha != component.sha256.to_lowercase() {
        return Err("asr_cuda_sha256_mismatch".into());
    }
    // Keep .zip.part for extract; only drop resume meta.
    clear_resume_meta(&tmp_meta);

    update_cuda_progress(
        handle,
        "installing",
        "正在解压 GPU 加速组件…",
        Some(component.version.clone()),
        None,
        None,
        None,
    );
    let staging_root = cuda_staging_root(app_root);
    let staging = staging_root.join(format!("staging-{}", Uuid::new_v4()));
    let _ = fs::remove_dir_all(&staging_root);
    fs::create_dir_all(&staging_root).map_err(|e| format!("asr_cuda_staging_failed: {e}"))?;
    extract_zip(&tmp_zip, &staging, &cancel)?;
    clear_resume_artifacts(&tmp_zip, &tmp_meta);

    let staged_exe = match resolve_staged_cuda_exe(&staging, &component.exe_relpath) {
        Some(p) => p,
        None => {
            let _ = fs::remove_dir_all(&staging);
            return Err("asr_cuda_executable_missing".into());
        }
    };

    update_cuda_progress(
        handle,
        "verifying",
        "正在验证 GPU 加速组件可用性…",
        Some(component.version.clone()),
        None,
        None,
        None,
    );
    let models_root = crate::project::models_root_for_app_data_root(app_root);
    if let Err(err) = verify_installed_runtime(&staged_exe, Some(&models_root), Some(&cancel)) {
        let _ = fs::remove_dir_all(&staging);
        return Err(err.replace("local_runtime_verify_", "asr_cuda_verify_"));
    }

    let install_dir = cuda_sidecar_install_dir(app_root);
    promote_cuda_onedir(&install_dir, &staged_exe)?;
    let _ = fs::remove_dir_all(&staging_root);

    let installed_exe = install_dir.join("rushi-asr-sidecar-cuda.exe");
    if !installed_exe.is_file() {
        let _ = fs::remove_dir_all(&install_dir);
        return Err("asr_cuda_executable_missing".into());
    }
    write_cuda_installed_version(app_root, &component.version)?;

    update_cuda_progress(
        handle,
        "installed",
        "GPU 加速组件已安装。请重启侧车以启用加速。",
        Some(component.version.clone()),
        None,
        None,
        None,
    );
    append_cuda_log_line(
        handle,
        &format!(
            "INFO asr_cuda_installed version={} signature_key={} source={}",
            component.version, signature_key_id, manifest_source
        ),
    );
    Ok(())
}

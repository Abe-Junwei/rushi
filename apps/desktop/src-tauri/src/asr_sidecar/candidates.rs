use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::DbState;

fn validate_bundled_exe(exe: &Path) -> Option<PathBuf> {
    if exe.is_file() {
        if let Ok(meta) = std::fs::metadata(exe) {
            if meta.len() > 1024 {
                return Some(exe.to_path_buf());
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn sidecar_exe_path(resource_root: &Path, onedir: &str, stem: &str) -> Option<PathBuf> {
    let exe = resource_root
        .join("bundled-asr")
        .join(onedir)
        .join(format!("{stem}.exe"));
    validate_bundled_exe(&exe)
}

#[cfg(not(target_os = "windows"))]
fn sidecar_exe_path(resource_root: &Path, onedir: &str, stem: &str) -> Option<PathBuf> {
    let exe = resource_root.join("bundled-asr").join(onedir).join(stem);
    validate_bundled_exe(&exe)
}

fn bundled_cpu_executable(resource_root: &Path) -> Option<PathBuf> {
    sidecar_exe_path(resource_root, "rushi-asr-sidecar", "rushi-asr-sidecar")
}

#[cfg(target_os = "windows")]
fn bundled_cuda_executable(resource_root: &Path) -> Option<PathBuf> {
    sidecar_exe_path(
        resource_root,
        "rushi-asr-sidecar-cuda",
        "rushi-asr-sidecar-cuda",
    )
}

/// Heuristic: NVIDIA user-mode driver + `nvidia-smi` ship path (DCH vs legacy).
#[cfg(target_os = "windows")]
fn windows_cuda_probe_ok() -> bool {
    const NV_CUDA: &str = r"C:\Windows\System32\nvcuda.dll";
    const NV_SMI_SYS32: &str = r"C:\Windows\System32\nvidia-smi.exe";
    const NV_SMI_LEGACY: &str = r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe";
    Path::new(NV_CUDA).is_file()
        && (Path::new(NV_SMI_SYS32).is_file() || Path::new(NV_SMI_LEGACY).is_file())
}

#[cfg(target_os = "windows")]
fn bundled_sidecar_try_order(resource_root: &Path) -> Vec<PathBuf> {
    let force_cpu = std::env::var("RUSHI_FORCE_BUNDLED_ASR_CPU").ok().as_deref() == Some("1");
    let cpu = bundled_cpu_executable(resource_root);
    let cuda = bundled_cuda_executable(resource_root);
    let mut out = Vec::new();
    if force_cpu {
        if let Some(p) = cpu {
            out.push(p);
        }
        return out;
    }
    if let (Some(cuda_p), Some(cpu_p)) = (&cuda, &cpu) {
        if windows_cuda_probe_ok() {
            out.push(cuda_p.clone());
        }
        out.push(cpu_p.clone());
    } else if let Some(cuda_p) = cuda {
        if windows_cuda_probe_ok() {
            out.push(cuda_p);
        } else if let Some(cpu_p) = cpu {
            out.push(cpu_p);
        }
    } else if let Some(cpu_p) = cpu {
        out.push(cpu_p);
    }
    out
}

#[cfg(not(target_os = "windows"))]
fn bundled_sidecar_try_order(resource_root: &Path) -> Vec<PathBuf> {
    bundled_cpu_executable(resource_root).into_iter().collect()
}

pub(crate) fn candidate_resource_roots_from_parts(
    resource_dir: Option<PathBuf>,
    manifest_dir: &Path,
) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(res_dir) = resource_dir {
        roots.push(res_dir.clone());
        if res_dir.file_name().and_then(|s| s.to_str()) != Some("resources") {
            roots.push(res_dir.join("resources"));
        }
    }

    roots.push(manifest_dir.join("target").join("debug").join("resources"));
    roots.push(
        manifest_dir
            .parent()
            .unwrap_or(manifest_dir)
            .join("target")
            .join("debug")
            .join("resources"),
    );
    roots.push(manifest_dir.join("resources"));

    let mut unique = Vec::new();
    for root in roots {
        if !unique.iter().any(|existing: &PathBuf| existing == &root) {
            unique.push(root);
        }
    }
    unique
}

fn candidate_resource_roots(handle: &AppHandle) -> Vec<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidate_resource_roots_from_parts(handle.path().resource_dir().ok(), &manifest_dir)
}

pub(crate) fn bundled_sidecar_candidates_from_roots(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for root in roots {
        for exe in bundled_sidecar_try_order(root) {
            if !out.iter().any(|existing: &PathBuf| existing == &exe) {
                out.push(exe);
            }
        }
    }
    out
}

fn bundled_sidecar_candidates(handle: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for exe in bundled_sidecar_candidates_from_roots(&candidate_resource_roots(handle)) {
        if !out.iter().any(|existing: &PathBuf| existing == &exe) {
            out.push(exe);
        }
    }
    if let Some(st) = handle.try_state::<DbState>() {
        if let Some(exe) = crate::local_runtime::integrity::resolve_installed_executable(&st.root) {
            if !out.iter().any(|existing: &PathBuf| existing == &exe) {
                out.push(exe);
            }
        }
    }
    out
}

pub(super) fn bundled_sidecar_candidates_for_launch(handle: &AppHandle) -> Vec<PathBuf> {
    bundled_sidecar_candidates(handle)
}

/// True when install media includes at least one bundled sidecar executable.
pub fn bundled_sidecar_resources_present(handle: &AppHandle) -> bool {
    !bundled_sidecar_candidates_from_roots(&candidate_resource_roots(handle)).is_empty()
}

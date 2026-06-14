//! Bundled ASR sidecar resource roots (release `.app` / dev `resources/`).
//! Shared by sidecar launch, waveform peaks ffmpeg remux, and ffprobe duration.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};

static RESOURCE_ROOTS: OnceLock<Vec<PathBuf>> = OnceLock::new();

pub fn init_from_app(handle: &AppHandle) {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let roots =
        candidate_resource_roots_from_parts(handle.path().resource_dir().ok(), &manifest_dir);
    let _ = RESOURCE_ROOTS.set(roots);
}

pub fn candidate_resource_roots_from_parts(
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

fn resource_roots_for_lookup() -> Vec<PathBuf> {
    if let Some(cached) = RESOURCE_ROOTS.get() {
        return cached.clone();
    }
    candidate_resource_roots_from_parts(None, &PathBuf::from(env!("CARGO_MANIFEST_DIR")))
}

fn bundled_internal_tool(roots: &[PathBuf], name: &str) -> Option<PathBuf> {
    for root in roots {
        for onedir in ["rushi-asr-sidecar", "rushi-asr-sidecar-cuda"] {
            let internal = root.join("bundled-asr").join(onedir).join("_internal");
            #[cfg(target_os = "windows")]
            let tool = internal.join(format!("{name}.exe"));
            #[cfg(not(target_os = "windows"))]
            let tool = internal.join(name);
            if tool.is_file() {
                return Some(tool);
            }
        }
    }
    None
}

/// PyInstaller sidecar build stamp (`sidecar-build-stamp.txt` from `build-asr-sidecar-unix.sh`).
pub fn read_bundled_sidecar_build_stamp() -> Option<String> {
    for root in resource_roots_for_lookup() {
        for onedir in ["rushi-asr-sidecar", "rushi-asr-sidecar-cuda"] {
            let path = root
                .join("bundled-asr")
                .join(onedir)
                .join("sidecar-build-stamp.txt");
            if let Ok(text) = std::fs::read_to_string(&path) {
                let summary = text
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");
                if !summary.is_empty() {
                    return Some(summary);
                }
            }
        }
    }
    None
}

pub fn resolve_bundled_ffmpeg() -> PathBuf {
    bundled_internal_tool(&resource_roots_for_lookup(), "ffmpeg")
        .unwrap_or_else(|| PathBuf::from("ffmpeg"))
}

pub fn resolve_bundled_ffprobe_from_roots(roots: &[PathBuf]) -> PathBuf {
    bundled_internal_tool(roots, "ffprobe").unwrap_or_else(|| PathBuf::from("ffprobe"))
}

pub fn resolve_bundled_ffprobe() -> PathBuf {
    resolve_bundled_ffprobe_from_roots(&resource_roots_for_lookup())
}

pub fn cached_resource_roots() -> Option<&'static [PathBuf]> {
    RESOURCE_ROOTS.get().map(|v| v.as_slice())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_ffmpeg_from_release_style_resource_root() {
        let temp =
            std::env::temp_dir().join(format!("rushi-bundled-assets-{}", uuid::Uuid::new_v4()));
        let internal = temp
            .join("bundled-asr")
            .join("rushi-asr-sidecar")
            .join("_internal");
        std::fs::create_dir_all(&internal).unwrap();
        #[cfg(target_os = "windows")]
        let ffmpeg = internal.join("ffmpeg.exe");
        #[cfg(not(target_os = "windows"))]
        let ffmpeg = internal.join("ffmpeg");
        std::fs::write(&ffmpeg, b"").unwrap();

        let manifest = std::path::PathBuf::from("/nonexistent/manifest");
        let roots = candidate_resource_roots_from_parts(Some(temp.clone()), &manifest);
        let resolved = bundled_internal_tool(&roots, "ffmpeg");
        assert_eq!(resolved.as_deref(), Some(ffmpeg.as_path()));

        let _ = std::fs::remove_dir_all(temp);
    }
}

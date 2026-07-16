mod download;
mod download_resume;
mod extract;
mod verify;

pub use download::{download_component_artifact, download_component_artifact_in, read_text_source};
pub use download_resume::{
    artifact_download_paths, artifact_download_paths_in, clear_resume_artifacts, clear_resume_meta,
};
pub use extract::extract_zip;
pub use verify::verify_installed_runtime;

use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub(crate) const MANIFEST_FETCH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
pub(crate) const HTTP_CONNECT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
pub(crate) const ARTIFACT_REQUEST_TIMEOUT: std::time::Duration =
    std::time::Duration::from_secs(30 * 60);

pub(crate) fn is_http_source(source: &str) -> bool {
    source.strip_prefix("http://").is_some() || source.strip_prefix("https://").is_some()
}

pub fn sha256_hex(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("open_download_failed: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0_u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("hash_read_failed: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn ensure_not_cancelled(cancel: &Arc<AtomicBool>) -> Result<(), String> {
    if cancel.load(Ordering::SeqCst) {
        Err("cancelled".into())
    } else {
        Ok(())
    }
}

pub fn disk_free_bytes(path: &Path) -> Option<u64> {
    let probe = if path.exists() {
        path.to_path_buf()
    } else {
        path.parent()?.to_path_buf()
    };

    #[cfg(unix)]
    {
        let output = std::process::Command::new("df")
            .arg("-k")
            .arg(&probe)
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let line = text.lines().last()?;
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            return None;
        }
        let available_k = parts[3].parse::<u64>().ok()?;
        Some(available_k * 1024)
    }

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

        let wide: Vec<u16> = probe
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut free = 0u64;
        unsafe {
            GetDiskFreeSpaceExW(PCWSTR(wide.as_ptr()), None, None, Some(&mut free)).ok()?;
        }
        Some(free)
    }

    #[cfg(not(any(unix, windows)))]
    {
        let _ = probe;
        None
    }
}

use super::ensure_not_cancelled;
use std::fs::{self, File};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use zip::ZipArchive;

const MAX_EXTRACT_BYTES: u64 = 6 * 1024 * 1024 * 1024;
const MAX_EXTRACT_ENTRIES: usize = 20_000;

pub fn extract_zip(zip_path: &Path, dest: &Path, cancel: &Arc<AtomicBool>) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("create_extract_dir_failed: {e}"))?;
    let file = File::open(zip_path).map_err(|e| format!("open_zip_failed: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("open_zip_failed: {e}"))?;
    let mut total_unpacked = 0_u64;
    for i in 0..archive.len() {
        ensure_not_cancelled(cancel)?;
        if i >= MAX_EXTRACT_ENTRIES {
            return Err("local_runtime_extract_too_many_entries".into());
        }
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("read_zip_entry_failed: {e}"))?;
        total_unpacked = total_unpacked.saturating_add(entry.size());
        if total_unpacked > MAX_EXTRACT_BYTES {
            return Err("local_runtime_extract_size_limit_exceeded".into());
        }
        let Some(rel) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            return Err("zip_path_traversal".into());
        };
        let out_path = dest.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| format!("create_dir_failed: {e}"))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create_dir_failed: {e}"))?;
        }
        let mut out = File::create(&out_path).map_err(|e| format!("create_file_failed: {e}"))?;
        std::io::copy(&mut entry, &mut out).map_err(|e| format!("extract_file_failed: {e}"))?;
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(mode));
        }
    }
    Ok(())
}

use super::paths::local_runtime_root;
use super::read_marker;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

fn reserved_runtime_dir_names() -> HashSet<&'static str> {
    HashSet::from(["downloads"])
}

fn keep_version_dirs(app_root: &Path) -> HashSet<String> {
    let mut keep = HashSet::new();
    if let Ok(marker) = read_marker(app_root) {
        keep.insert(marker.version);
        if let Some(previous) = marker.previous_version {
            keep.insert(previous);
        }
    }
    keep
}

pub fn gc_stale_version_dirs(app_root: &Path) -> Result<(), String> {
    let root = local_runtime_root(app_root);
    let Ok(entries) = fs::read_dir(&root) else {
        return Ok(());
    };
    let keep = keep_version_dirs(app_root);
    let reserved = reserved_runtime_dir_names();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if reserved.contains(name) || name.starts_with("staging-") || name.starts_with("rollback-")
        {
            continue;
        }
        if keep.contains(name) {
            continue;
        }
        fs::remove_dir_all(&path)
            .map_err(|e| format!("gc_remove_version_dir_failed:{name}:{e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::local_runtime::integrity::{version_dir, write_marker_with_previous};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn gc_keeps_current_and_previous_version_dirs() {
        let root = std::env::temp_dir().join(format!(
            "rushi-runtime-gc-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let app_root = root.join("app_data");
        write_marker_with_previous(
            &app_root,
            "0.2.0",
            "rushi-asr-sidecar/rushi-asr-sidecar",
            Some(("0.1.0", "rushi-asr-sidecar/rushi-asr-sidecar")),
            Some("ready"),
        )
        .unwrap();
        for version in ["0.1.0", "0.2.0", "0.0.9"] {
            let dir = version_dir(&app_root, version);
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join("marker.txt"), version).unwrap();
        }

        gc_stale_version_dirs(&app_root).unwrap();

        assert!(version_dir(&app_root, "0.1.0").is_dir());
        assert!(version_dir(&app_root, "0.2.0").is_dir());
        assert!(!version_dir(&app_root, "0.0.9").exists());
        let _ = fs::remove_dir_all(root);
    }
}

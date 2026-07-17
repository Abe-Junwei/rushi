use crate::local_runtime::integrity::local_runtime_root;
use crate::local_runtime::manifest::RuntimeComponent;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DownloadResumeMeta {
    pub version: String,
    pub sha256: String,
    pub url: String,
    pub total_bytes: Option<u64>,
    pub updated_at_ms: u64,
}

pub fn downloads_dir(app_root: &Path) -> PathBuf {
    local_runtime_root(app_root).join("downloads")
}

pub fn artifact_download_paths_in(
    downloads: &Path,
    component: &RuntimeComponent,
) -> (PathBuf, PathBuf) {
    let sha_tag = component
        .sha256
        .trim()
        .to_ascii_lowercase()
        .chars()
        .take(16)
        .collect::<String>();
    let safe_version = component
        .version
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();
    let part = downloads.join(format!("{safe_version}-{sha_tag}.zip.part"));
    let meta = PathBuf::from(format!("{}.meta.json", part.display()));
    (part, meta)
}

pub fn artifact_download_paths(
    app_root: &Path,
    component: &RuntimeComponent,
) -> (PathBuf, PathBuf) {
    artifact_download_paths_in(&downloads_dir(app_root), component)
}

/// Resume meta only — keep the `.zip.part` payload for extract after a successful download.
pub fn clear_resume_meta(meta_path: &Path) {
    let _ = fs::remove_file(meta_path);
}

pub fn load_resume_meta(meta_path: &Path) -> Option<DownloadResumeMeta> {
    let raw = fs::read_to_string(meta_path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save_resume_meta(meta_path: &Path, meta: &DownloadResumeMeta) -> Result<(), String> {
    if let Some(parent) = meta_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("download_meta_dir_failed: {e}"))?;
    }
    let bytes =
        serde_json::to_vec_pretty(meta).map_err(|e| format!("download_meta_encode_failed: {e}"))?;
    fs::write(meta_path, bytes).map_err(|e| format!("download_meta_write_failed: {e}"))
}

pub fn clear_resume_artifacts(part_path: &Path, meta_path: &Path) {
    let _ = fs::remove_file(part_path);
    let _ = fs::remove_file(meta_path);
}

pub fn resume_matches_component(meta: &DownloadResumeMeta, component: &RuntimeComponent) -> bool {
    meta.version == component.version && meta.sha256.eq_ignore_ascii_case(component.sha256.trim())
}

pub fn existing_part_offset(part_path: &Path) -> u64 {
    fs::metadata(part_path).map(|m| m.len()).unwrap_or(0)
}

/// Drop partial files when artifact identity changed.
pub fn ensure_resume_compatible(
    part_path: &Path,
    meta_path: &Path,
    component: &RuntimeComponent,
) -> Result<(), String> {
    let Some(meta) = load_resume_meta(meta_path) else {
        if part_path.is_file() && !meta_path.is_file() {
            let _ = fs::remove_file(part_path);
        }
        return Ok(());
    };
    if resume_matches_component(&meta, component) {
        return Ok(());
    }
    clear_resume_artifacts(part_path, meta_path);
    Ok(())
}

pub fn gc_stale_download_parts_in(dir: &Path, keep_part: &Path, keep_meta: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path == keep_part || path == keep_meta {
            continue;
        }
        if path.extension().and_then(|x| x.to_str()) == Some("part")
            || path
                .file_name()
                .and_then(|x| x.to_str())
                .is_some_and(|n| n.ends_with(".meta.json"))
        {
            let _ = if path.is_dir() {
                fs::remove_dir_all(&path)
            } else {
                fs::remove_file(&path)
            };
        }
    }
}

#[allow(dead_code)] // retained for LRC callers / tests that GC the default downloads dir
pub fn gc_stale_download_parts(app_root: &Path, component: &RuntimeComponent) {
    let dir = downloads_dir(app_root);
    let (keep_part, keep_meta) = artifact_download_paths_in(&dir, component);
    gc_stale_download_parts_in(&dir, &keep_part, &keep_meta);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::local_runtime::manifest::RuntimeComponent;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn sample_component() -> RuntimeComponent {
        RuntimeComponent {
            id: "asr-sidecar".into(),
            version: "0.2.0".into(),
            platform: "darwin-arm64".into(),
            url: "https://example.invalid/asr.zip".into(),
            sha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789".into(),
            exe_relpath: "rushi-asr-sidecar/rushi-asr-sidecar".into(),
            min_shell_version: None,
            mirror_urls: vec![],
            size_bytes: Some(1024),
            format: Some("zip-onedir".into()),
        }
    }

    #[test]
    fn artifact_paths_are_stable_for_same_component() {
        let root = std::env::temp_dir().join("rushi-download-resume-test");
        let c = sample_component();
        let (a, ma) = artifact_download_paths(&root, &c);
        let (b, mb) = artifact_download_paths(&root, &c);
        assert_eq!(a, b);
        assert_eq!(ma, mb);
        assert!(a.to_string_lossy().contains("0.2.0"));
    }

    #[test]
    fn artifact_paths_in_custom_dir_stay_isolated() {
        let root = std::env::temp_dir().join(format!(
            "rushi-download-resume-custom-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let downloads = root.join("cuda-downloads");
        let c = sample_component();
        let (part, meta) = artifact_download_paths_in(&downloads, &c);
        assert!(part.starts_with(&downloads));
        assert!(meta.to_string_lossy().ends_with(".meta.json"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn clear_resume_meta_keeps_part_file() {
        let root = std::env::temp_dir().join(format!(
            "rushi-download-resume-meta-only-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let downloads = root.join("downloads");
        let c = sample_component();
        let (part, meta) = artifact_download_paths_in(&downloads, &c);
        fs::create_dir_all(part.parent().unwrap()).unwrap();
        fs::write(&part, b"payload").unwrap();
        fs::write(&meta, b"{}").unwrap();
        clear_resume_meta(&meta);
        assert!(part.is_file());
        assert!(!meta.is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn incompatible_meta_clears_partial_files() {
        let root = std::env::temp_dir().join(format!(
            "rushi-download-resume-incompat-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let component = sample_component();
        let (part, meta) = artifact_download_paths(&root, &component);
        fs::create_dir_all(part.parent().unwrap()).unwrap();
        fs::write(&part, b"partial").unwrap();
        fs::write(
            &meta,
            serde_json::to_string(&DownloadResumeMeta {
                version: "0.1.0".into(),
                sha256: "deadbeef".into(),
                url: "https://old".into(),
                total_bytes: Some(99),
                updated_at_ms: 1,
            })
            .unwrap(),
        )
        .unwrap();

        let mut next = component.clone();
        next.version = "0.3.0".into();
        ensure_resume_compatible(&part, &meta, &next).unwrap();
        assert!(!part.is_file());
        assert!(!meta.is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn orphan_part_without_meta_is_removed() {
        let root = std::env::temp_dir().join(format!(
            "rushi-download-resume-orphan-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let component = sample_component();
        let (part, meta) = artifact_download_paths(&root, &component);
        fs::create_dir_all(part.parent().unwrap()).unwrap();
        fs::write(&part, b"orphan").unwrap();
        assert!(!meta.is_file());

        ensure_resume_compatible(&part, &meta, &component).unwrap();
        assert!(!part.is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resume_meta_roundtrip_matches_component() {
        let root = std::env::temp_dir().join(format!(
            "rushi-download-resume-meta-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let component = sample_component();
        let (_, meta) = artifact_download_paths(&root, &component);
        fs::create_dir_all(meta.parent().unwrap()).unwrap();
        let saved = DownloadResumeMeta {
            version: component.version.clone(),
            sha256: component.sha256.trim().to_ascii_lowercase(),
            url: component.url.clone(),
            total_bytes: component.size_bytes,
            updated_at_ms: 42,
        };
        save_resume_meta(&meta, &saved).unwrap();
        let loaded = load_resume_meta(&meta).expect("meta should load");
        assert!(resume_matches_component(&loaded, &component));
        let _ = fs::remove_dir_all(root);
    }
}

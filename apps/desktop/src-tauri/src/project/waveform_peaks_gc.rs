use super::project_storage::{
    project_storage_dir, projects_storage_root, remove_project_storage_dir,
};
use super::utils::open_db;
use super::waveform_peaks::{peaks_dir, remove_peaks_for_file, PEAK_LEVELS};
use crate::DbState;
use rusqlite::params;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct WaveformPeaksCacheInfo {
    pub projects_root: String,
    pub total_bytes: u64,
    pub orphan_bytes: u64,
    pub orphan_file_sets: u32,
    pub orphan_project_dirs: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct WaveformPeaksGcReport {
    pub removed_file_sets: u32,
    pub removed_project_dirs: u32,
    pub freed_bytes: u64,
}

pub fn file_id_from_peaks_entry(name: &str) -> Option<String> {
    if let Some(id) = name.strip_suffix(".meta.json") {
        return Some(id.to_string());
    }
    if let Some(id) = name.strip_suffix(".generating.lock") {
        return Some(id.to_string());
    }
    for (level, _) in PEAK_LEVELS {
        let suffix = format!("_L{level}.dat");
        if let Some(id) = name.strip_suffix(&suffix) {
            return Some(id.to_string());
        }
    }
    None
}

fn projects_root(app_root: &Path) -> PathBuf {
    projects_storage_root(app_root)
}

fn dir_size_bytes(path: &Path) -> u64 {
    if path.is_file() {
        return fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    }
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| dir_size_bytes(&entry.path()))
        .sum()
}

fn active_file_ids(st: &DbState, project_id: &str) -> Result<HashSet<String>, String> {
    let conn = open_db(st)?;
    let mut stmt = conn
        .prepare("SELECT id FROM files WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut out = HashSet::new();
    for row in rows {
        out.insert(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn list_project_ids(st: &DbState) -> Result<HashSet<String>, String> {
    let conn = open_db(st)?;
    let mut stmt = conn
        .prepare("SELECT id FROM projects")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut out = HashSet::new();
    for row in rows {
        out.insert(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn orphan_project_dirs(app_root: &Path, active_projects: &HashSet<String>) -> Vec<PathBuf> {
    let root = projects_root(app_root);
    let Ok(entries) = fs::read_dir(&root) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            let name = path.file_name()?.to_str()?;
            if active_projects.contains(name) {
                None
            } else {
                Some(path)
            }
        })
        .collect()
}

fn peaks_usage_for_project(
    project_dir: &Path,
    active_ids: &HashSet<String>,
) -> Result<(u64, u64, HashSet<String>), String> {
    let peaks_root = peaks_dir(project_dir);
    let Ok(entries) = fs::read_dir(&peaks_root) else {
        return Ok((0, 0, HashSet::new()));
    };
    let mut total_bytes = 0_u64;
    let mut orphan_bytes = 0_u64;
    let mut orphan_ids = HashSet::new();
    let mut bytes_by_id: HashMap<String, u64> = HashMap::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(file_id) = file_id_from_peaks_entry(name) else {
            continue;
        };
        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        total_bytes = total_bytes.saturating_add(size);
        *bytes_by_id.entry(file_id).or_insert(0) += size;
    }

    for (file_id, size) in bytes_by_id {
        if active_ids.contains(&file_id) {
            continue;
        }
        orphan_bytes = orphan_bytes.saturating_add(size);
        orphan_ids.insert(file_id);
    }

    Ok((total_bytes, orphan_bytes, orphan_ids))
}

fn project_dirs_for_peaks_scan(st: &DbState, project_id: &str) -> Vec<PathBuf> {
    let legacy = project_storage_dir(&st.root, project_id);
    let media =
        crate::media_base_dir::media_project_dir(st, project_id).unwrap_or_else(|_| legacy.clone());
    let mut dirs = vec![media];
    if dirs[0] != legacy {
        dirs.push(legacy);
    }
    dirs
}

fn gc_orphan_peaks_in_project_dir(
    project_dir: &Path,
    active_ids: &HashSet<String>,
) -> Result<WaveformPeaksGcReport, String> {
    let peaks_root = peaks_dir(project_dir);
    let (_, _, orphan_ids) = peaks_usage_for_project(project_dir, active_ids)?;
    let mut report = WaveformPeaksGcReport::default();
    for file_id in orphan_ids {
        let before = peaks_dir_size_for_file(&peaks_root, &file_id);
        remove_peaks_for_file(&peaks_root, &file_id);
        report.removed_file_sets = report.removed_file_sets.saturating_add(1);
        report.freed_bytes = report.freed_bytes.saturating_add(before);
    }
    Ok(report)
}

pub fn inspect_waveform_peaks_cache(st: &DbState) -> Result<WaveformPeaksCacheInfo, String> {
    let root = projects_root(&st.root);
    let active_projects = list_project_ids(st)?;
    let mut total_bytes = 0_u64;
    let mut orphan_bytes = 0_u64;
    let mut orphan_file_sets = 0_u32;

    for project_id in &active_projects {
        let active_ids = active_file_ids(st, project_id)?;
        for project_dir in project_dirs_for_peaks_scan(st, project_id) {
            let (project_total, project_orphan, orphan_ids) =
                peaks_usage_for_project(&project_dir, &active_ids)?;
            total_bytes = total_bytes.saturating_add(project_total);
            orphan_bytes = orphan_bytes.saturating_add(project_orphan);
            orphan_file_sets = orphan_file_sets.saturating_add(orphan_ids.len() as u32);
        }
    }

    let orphan_dirs = orphan_project_dirs(&st.root, &active_projects);
    let orphan_project_dirs = orphan_dirs.len() as u32;
    for path in &orphan_dirs {
        total_bytes = total_bytes.saturating_add(dir_size_bytes(path));
        orphan_bytes = orphan_bytes.saturating_add(dir_size_bytes(path));
    }

    Ok(WaveformPeaksCacheInfo {
        projects_root: root.to_string_lossy().into_owned(),
        total_bytes,
        orphan_bytes,
        orphan_file_sets,
        orphan_project_dirs,
    })
}

pub fn gc_orphan_peaks_for_project(
    st: &DbState,
    project_id: &str,
) -> Result<WaveformPeaksGcReport, String> {
    let active_ids = active_file_ids(st, project_id)?;
    let mut report = WaveformPeaksGcReport::default();
    for project_dir in project_dirs_for_peaks_scan(st, project_id) {
        let partial = gc_orphan_peaks_in_project_dir(&project_dir, &active_ids)?;
        report.removed_file_sets = report
            .removed_file_sets
            .saturating_add(partial.removed_file_sets);
        report.freed_bytes = report.freed_bytes.saturating_add(partial.freed_bytes);
    }
    Ok(report)
}

pub fn gc_orphan_waveform_peaks(st: &DbState) -> Result<WaveformPeaksGcReport, String> {
    let mut report = WaveformPeaksGcReport::default();
    let active_projects = list_project_ids(st)?;
    for project_id in &active_projects {
        let partial = gc_orphan_peaks_for_project(st, project_id)?;
        report.removed_file_sets = report
            .removed_file_sets
            .saturating_add(partial.removed_file_sets);
        report.freed_bytes = report.freed_bytes.saturating_add(partial.freed_bytes);
    }
    for path in orphan_project_dirs(&st.root, &active_projects) {
        let before = dir_size_bytes(&path);
        let project_id = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        if remove_project_storage_dir(&st.root, &project_id).is_ok() {
            report.removed_project_dirs = report.removed_project_dirs.saturating_add(1);
            report.freed_bytes = report.freed_bytes.saturating_add(before);
        }
    }
    Ok(report)
}

fn peaks_dir_size_for_file(peaks_root: &Path, file_id: &str) -> u64 {
    let mut total = 0_u64;
    for (level, _) in PEAK_LEVELS {
        let path = peaks_root.join(format!("{file_id}_L{level}.dat"));
        if let Ok(meta) = fs::metadata(&path) {
            total = total.saturating_add(meta.len());
        }
    }
    for suffix in [".meta.json", ".generating.lock"] {
        let path = peaks_root.join(format!("{file_id}{suffix}"));
        if let Ok(meta) = fs::metadata(&path) {
            total = total.saturating_add(meta.len());
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    fn test_state(label: &str) -> DbState {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi-peaks-gc-{label}-{unique}"));
        fs::create_dir_all(&root).unwrap();
        DbState::open_test_db(root)
    }

    fn seed_project(st: &DbState, project_id: &str, file_id: &str) {
        let conn = open_db(st).unwrap();
        let t = super::super::utils::now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![project_id, "P", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6)",
            params![file_id, project_id, "clip.wav", "paired", t, t],
        )
        .unwrap();
    }

    #[test]
    fn file_id_from_peaks_entry_parses_known_suffixes() {
        assert_eq!(
            file_id_from_peaks_entry("abc_L1.dat").as_deref(),
            Some("abc")
        );
        assert_eq!(
            file_id_from_peaks_entry("abc.meta.json").as_deref(),
            Some("abc")
        );
    }

    #[test]
    fn gc_removes_orphan_peaks_but_keeps_active_file() {
        let st = test_state("orphan");
        let project_id = Uuid::new_v4().to_string();
        let active_id = Uuid::new_v4().to_string();
        let orphan_id = Uuid::new_v4().to_string();
        seed_project(&st, &project_id, &active_id);

        let peaks_root = peaks_dir(&projects_root(&st.root).join(&project_id));
        fs::create_dir_all(&peaks_root).unwrap();
        fs::write(
            peaks_root.join(format!("{active_id}_L0.dat")),
            vec![0_u8; 10],
        )
        .unwrap();
        fs::write(
            peaks_root.join(format!("{orphan_id}_L0.dat")),
            vec![0_u8; 20],
        )
        .unwrap();
        fs::write(peaks_root.join(format!("{orphan_id}.meta.json")), b"{}").unwrap();

        let info = inspect_waveform_peaks_cache(&st).unwrap();
        assert_eq!(info.orphan_file_sets, 1);
        assert_eq!(info.orphan_bytes, 22);

        let report = gc_orphan_waveform_peaks(&st).unwrap();
        assert_eq!(report.removed_file_sets, 1);
        assert_eq!(report.freed_bytes, 22);
        assert!(peaks_root.join(format!("{active_id}_L0.dat")).is_file());
        assert!(!peaks_root.join(format!("{orphan_id}_L0.dat")).exists());
        let _ = fs::remove_dir_all(&st.root);
    }

    #[test]
    fn gc_removes_orphan_project_dirs_without_db_rows() {
        let st = test_state("orphan-project-dir");
        let orphan_project_id = Uuid::new_v4().to_string();
        let orphan_dir = projects_root(&st.root).join(&orphan_project_id);
        fs::create_dir_all(orphan_dir.join("peaks")).unwrap();
        fs::write(orphan_dir.join("peaks").join("stale_L0.dat"), b"stale").unwrap();

        let info = inspect_waveform_peaks_cache(&st).unwrap();
        assert_eq!(info.orphan_project_dirs, 1);

        let report = gc_orphan_waveform_peaks(&st).unwrap();
        assert_eq!(report.removed_project_dirs, 1);
        assert!(!orphan_dir.exists());
        let _ = fs::remove_dir_all(&st.root);
    }
}

use super::types::{WaveformPeakLevelStatus, WaveformPeaksStatus};
use super::utils::open_db;
use super::waveform_peaks::{
    generate_all_levels, peak_file_path, peaks_dir, remove_peaks_for_file, PeaksGenerationReport,
    PEAK_LEVELS,
};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use tauri::State;

fn project_dir(st: &DbState, project_id: &str) -> PathBuf {
    st.root.join("projects").join(project_id)
}

fn status_from_disk(
    peaks_root: &Path,
    file_id: &str,
    report: Option<&PeaksGenerationReport>,
) -> WaveformPeaksStatus {
    let levels = PEAK_LEVELS
        .iter()
        .map(|(level, pps)| {
            let path = peak_file_path(peaks_root, file_id, *level);
            WaveformPeakLevelStatus {
                level: *level,
                pixels_per_second: *pps,
                path: path.to_string_lossy().into_owned(),
                exists: path.is_file(),
            }
        })
        .collect();

    WaveformPeaksStatus {
        levels,
        sample_rate: report.map(|r| r.sample_rate),
        duration_sec: report.map(|r| r.duration_sec),
    }
}

fn load_existing_meta(peaks_root: &Path, file_id: &str) -> Option<PeaksGenerationReport> {
    let l1 = peak_file_path(peaks_root, file_id, 1);
    if !l1.is_file() {
        return None;
    }
    let data = std::fs::read(&l1).ok()?;
    if data.len() < 24 {
        return None;
    }
    let sample_rate = i32::from_le_bytes(data[8..12].try_into().ok()?) as u32;
    let length = i32::from_le_bytes(data[16..20].try_into().ok()?) as u64;
    let spp = i32::from_le_bytes(data[12..16].try_into().ok()?) as u64;
    let duration_sec = (length * spp) as f64 / sample_rate as f64;
    Some(PeaksGenerationReport {
        sample_rate,
        duration_sec,
        generated_levels: PEAK_LEVELS.iter().map(|(l, _)| *l).collect(),
    })
}

fn ensure_waveform_peaks_sync(
    st: &DbState,
    project_id: &str,
    file_id: &str,
) -> Result<WaveformPeaksStatus, String> {
    let conn = open_db(st)?;
    let audio_path: Option<String> = conn
        .query_row(
            "SELECT audio_path FROM files WHERE id = ?1 AND project_id = ?2",
            params![file_id, project_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let audio_path = match audio_path {
        Some(p) if !p.is_empty() => p,
        _ => return Ok(status_from_disk(&peaks_dir(&project_dir(st, project_id)), file_id, None)),
    };

    let peaks_root = peaks_dir(&project_dir(st, project_id));
    let all_exist = PEAK_LEVELS
        .iter()
        .all(|(level, _)| peak_file_path(&peaks_root, file_id, *level).is_file());
    if all_exist {
        let report = load_existing_meta(&peaks_root, file_id);
        return Ok(status_from_disk(&peaks_root, file_id, report.as_ref()));
    }

    let report = generate_all_levels(Path::new(&audio_path), &peaks_root, file_id)?;
    Ok(status_from_disk(&peaks_root, file_id, Some(&report)))
}

#[tauri::command]
pub fn waveform_peaks_status(
    state: State<DbState>,
    project_id: String,
    file_id: String,
) -> Result<WaveformPeaksStatus, String> {
    let st = state.deref();
    let peaks_root = peaks_dir(&project_dir(st, &project_id));
    let report = load_existing_meta(&peaks_root, &file_id);
    Ok(status_from_disk(&peaks_root, &file_id, report.as_ref()))
}

#[tauri::command]
pub async fn ensure_waveform_peaks(
    state: State<'_, DbState>,
    project_id: String,
    file_id: String,
) -> Result<WaveformPeaksStatus, String> {
    let st = state.inner().clone();
    tokio::task::spawn_blocking(move || ensure_waveform_peaks_sync(&st, &project_id, &file_id))
        .await
        .map_err(|e| format!("peaks 任务失败: {e}"))?
}

pub fn cleanup_peaks_for_file(st: &DbState, project_id: &str, file_id: &str) {
    let peaks_root = peaks_dir(&project_dir(st, project_id));
    remove_peaks_for_file(&peaks_root, file_id);
}

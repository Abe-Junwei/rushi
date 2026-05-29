use super::transcribe_timeout::probe_audio_duration_sec;
use super::types::{WaveformPeakLevelStatus, WaveformPeaksStatus};
use super::utils::open_db;
use super::waveform_peaks::{
    all_peak_levels_exist, load_peaks_meta, peak_file_path, peaks_cache_is_stale,
    peaks_dir, remove_peaks_for_file, try_acquire_peaks_lock, wait_for_peaks_ready,
    PeaksGenerationReport, PeaksStaleCheckOptions, PEAK_LEVELS,
};
use super::waveform_peaks_generate::{generate_all_levels, probe_symphonia_track_duration_sec};
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
    if let Some(report) = load_peaks_meta(peaks_root, file_id) {
        return Some(report);
    }
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
        audio_fingerprint: None,
    })
}

fn resolve_reference_duration_sec(
    audio_path: &Path,
    media_duration_sec: Option<f64>,
) -> Option<f64> {
    let mut best = 0.0_f64;
    let mut any = false;
    for candidate in [
        media_duration_sec,
        probe_audio_duration_sec(audio_path),
        probe_symphonia_track_duration_sec(audio_path),
    ] {
        if let Some(d) = candidate.filter(|v| v.is_finite() && *v > 0.0) {
            any = true;
            if d > best {
                best = d;
            }
        }
    }
    any.then_some(best)
}

fn stale_check_options(
    audio_path: &Path,
    media_duration_sec: Option<f64>,
) -> PeaksStaleCheckOptions {
    PeaksStaleCheckOptions {
        reference_media_duration_sec: resolve_reference_duration_sec(audio_path, media_duration_sec),
        probed_audio_duration_sec: None,
    }
}

fn invalidate_peaks_if_stale(
    peaks_root: &Path,
    file_id: &str,
    audio_path: &Path,
    force: bool,
    media_duration_sec: Option<f64>,
) -> Result<bool, String> {
    if force {
        remove_peaks_for_file(peaks_root, file_id);
        return Ok(true);
    }
    let stale = peaks_cache_is_stale(
        peaks_root,
        file_id,
        audio_path,
        stale_check_options(audio_path, media_duration_sec),
    )?;
    if stale {
        remove_peaks_for_file(peaks_root, file_id);
        return Ok(true);
    }
    Ok(false)
}

fn ensure_waveform_peaks_sync(
    st: &DbState,
    project_id: &str,
    file_id: &str,
    force: bool,
    media_duration_sec: Option<f64>,
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
    let audio = Path::new(&audio_path);

    if !invalidate_peaks_if_stale(&peaks_root, file_id, audio, force, media_duration_sec)?
        && all_peak_levels_exist(&peaks_root, file_id)
    {
        let report = load_existing_meta(&peaks_root, file_id);
        return Ok(status_from_disk(&peaks_root, file_id, report.as_ref()));
    }

    if let Some(_lock) = try_acquire_peaks_lock(&peaks_root, file_id)? {
        if !invalidate_peaks_if_stale(&peaks_root, file_id, audio, force, media_duration_sec)?
            && all_peak_levels_exist(&peaks_root, file_id)
        {
            let report = load_existing_meta(&peaks_root, file_id);
            return Ok(status_from_disk(&peaks_root, file_id, report.as_ref()));
        }

        let report = generate_all_levels(audio, &peaks_root, file_id)?;
        Ok(status_from_disk(&peaks_root, file_id, Some(&report)))
    } else {
        wait_for_peaks_ready(&peaks_root, file_id)?;
        if peaks_cache_is_stale(
            &peaks_root,
            file_id,
            audio,
            stale_check_options(audio, media_duration_sec),
        )? {
            return ensure_waveform_peaks_sync(st, project_id, file_id, true, media_duration_sec);
        }
        let report = load_existing_meta(&peaks_root, file_id);
        Ok(status_from_disk(&peaks_root, file_id, report.as_ref()))
    }
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
    force: Option<bool>,
    media_duration_sec: Option<f64>,
) -> Result<WaveformPeaksStatus, String> {
    let force = force.unwrap_or(false);
    let st = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        ensure_waveform_peaks_sync(&st, &project_id, &file_id, force, media_duration_sec)
    })
    .await
    .map_err(|e| format!("peaks 任务失败: {e}"))?
}

pub fn cleanup_peaks_for_file(st: &DbState, project_id: &str, file_id: &str) {
    let peaks_root = peaks_dir(&project_dir(st, project_id));
    remove_peaks_for_file(&peaks_root, file_id);
}

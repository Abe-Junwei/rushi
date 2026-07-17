use super::transcribe_timeout::probe_audio_duration_sec;
use super::types::{WaveformPeakLevelStatus, WaveformPeaksStatus};
use super::utils::{append_desktop_log_line, open_db};
use super::waveform_peaks::{
    all_peak_levels_exist, load_peaks_meta, peak_file_path, peaks_cache_is_stale, peaks_dir,
    peaks_generation_in_progress, reclaim_stale_peaks_lock, remove_peaks_data_for_file,
    remove_peaks_for_file, try_acquire_peaks_lock, PeaksGenerationReport, PeaksStaleCheckOptions,
    PEAK_LEVELS,
};
use super::waveform_peaks_ffmpeg::{
    remux_audio_to_pcm_wav, symphonia_error_eligible_for_ffmpeg_remux,
};
use super::waveform_peaks_generate::{
    generate_all_levels, generate_all_levels_trust_decoded_length,
    probe_symphonia_track_duration_sec,
};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use tauri::State;

fn project_dir(st: &DbState, project_id: &str) -> PathBuf {
    crate::media_base_dir::media_project_dir(st, project_id)
        .unwrap_or_else(|_| st.root.join("projects").join(project_id))
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
        generating: peaks_generation_in_progress(peaks_root, file_id),
    }
}

fn status_from_disk_with_probe(
    peaks_root: &Path,
    file_id: &str,
    report: Option<&PeaksGenerationReport>,
    audio_path: Option<&Path>,
    media_duration_sec: Option<f64>,
) -> WaveformPeaksStatus {
    let mut st = status_from_disk(peaks_root, file_id, report);
    if st.duration_sec.is_none() {
        if let Some(audio) = audio_path {
            st.duration_sec = resolve_reference_duration_sec(audio, media_duration_sec);
        }
    }
    st
}

fn spawn_peaks_generation(
    st: DbState,
    audio: PathBuf,
    peaks_root: PathBuf,
    file_id: String,
    lock: super::waveform_peaks::PeaksGenerationLock,
) {
    std::thread::spawn(move || {
        let _lock = lock;
        if let Err(err) = generate_peaks_with_optional_ffmpeg_remux(&audio, &peaks_root, &file_id) {
            append_desktop_log_line(
                &st,
                &format!("ERROR waveform_peaks generation failed {file_id}: {err}"),
            );
        }
    });
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
        reference_media_duration_sec: resolve_reference_duration_sec(
            audio_path,
            media_duration_sec,
        ),
        probed_audio_duration_sec: None,
    }
}

/// When all peak levels exist, skip symphonia/ffprobe and use caller/meta duration.
fn stale_check_options_cache_fresh(
    peaks_root: &Path,
    file_id: &str,
    audio_path: &Path,
    media_duration_sec: Option<f64>,
) -> PeaksStaleCheckOptions {
    if let Some(d) = media_duration_sec.filter(|v| v.is_finite() && *v > 0.0) {
        return PeaksStaleCheckOptions {
            reference_media_duration_sec: Some(d),
            probed_audio_duration_sec: None,
        };
    }
    if let Some(report) = load_existing_meta(peaks_root, file_id) {
        if report.duration_sec.is_finite() && report.duration_sec > 0.0 {
            return PeaksStaleCheckOptions {
                reference_media_duration_sec: Some(report.duration_sec),
                probed_audio_duration_sec: None,
            };
        }
    }
    stale_check_options(audio_path, media_duration_sec)
}

fn invalidate_peaks_if_stale_with_options(
    peaks_root: &Path,
    file_id: &str,
    audio_path: &Path,
    force: bool,
    stale_opts: PeaksStaleCheckOptions,
) -> Result<bool, String> {
    if force {
        // Never unlink a live `.generating.lock` — that races with the holder and
        // makes status.generating=false while peaks keep building in the background.
        if peaks_generation_in_progress(peaks_root, file_id) {
            return Ok(false);
        }
        remove_peaks_data_for_file(peaks_root, file_id);
        return Ok(true);
    }
    let stale = peaks_cache_is_stale(peaks_root, file_id, audio_path, stale_opts)?;
    if stale {
        if peaks_generation_in_progress(peaks_root, file_id) {
            return Ok(false);
        }
        remove_peaks_data_for_file(peaks_root, file_id);
        return Ok(true);
    }
    Ok(false)
}

fn generate_peaks_with_optional_ffmpeg_remux(
    audio: &Path,
    peaks_root: &Path,
    file_id: &str,
) -> Result<PeaksGenerationReport, String> {
    match generate_all_levels(audio, peaks_root, file_id) {
        Ok(report) => Ok(report),
        Err(err) if symphonia_error_eligible_for_ffmpeg_remux(&err) => {
            let remux_path = peaks_root.join(format!("{file_id}.peaks-remux.wav"));
            let remux_result = remux_audio_to_pcm_wav(audio, &remux_path).and_then(|()| {
                generate_all_levels_trust_decoded_length(&remux_path, peaks_root, file_id)
            });
            let _ = std::fs::remove_file(&remux_path);
            remux_result.map_err(|remux_err| format!("{err}；ffmpeg remux 回退失败: {remux_err}"))
        }
        Err(err) => Err(err),
    }
}

fn ensure_waveform_peaks_sync(
    st: &DbState,
    project_id: &str,
    file_id: &str,
    force: bool,
    media_duration_sec: Option<f64>,
) -> Result<WaveformPeaksStatus, String> {
    ensure_waveform_peaks_sync_with_depth(st, project_id, file_id, force, media_duration_sec, 0)
}

fn ensure_waveform_peaks_sync_with_depth(
    st: &DbState,
    project_id: &str,
    file_id: &str,
    force: bool,
    media_duration_sec: Option<f64>,
    depth: u8,
) -> Result<WaveformPeaksStatus, String> {
    const MAX_ENSURE_RETRY_DEPTH: u8 = 2;
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
        _ => {
            return Ok(status_from_disk(
                &peaks_dir(&project_dir(st, project_id)),
                file_id,
                None,
            ))
        }
    };

    let peaks_root = peaks_dir(&project_dir(st, project_id));
    let audio = crate::media_base_dir::resolve_audio_path(st, &audio_path)?;
    let effective_duration = resolve_reference_duration_sec(&audio, media_duration_sec);

    // Crash / kill can leave `.generating.lock` forever (create_new existence lock,
    // not OS flock). Reclaim before acquire so 3h+ media is not stuck on a dead wait.
    reclaim_stale_peaks_lock(&peaks_root, file_id, effective_duration);

    let cache_complete = all_peak_levels_exist(&peaks_root, file_id);
    let stale_opts = if cache_complete {
        stale_check_options_cache_fresh(&peaks_root, file_id, &audio, media_duration_sec)
    } else {
        stale_check_options(&audio, media_duration_sec)
    };

    if !invalidate_peaks_if_stale_with_options(&peaks_root, file_id, &audio, force, stale_opts)?
        && cache_complete
    {
        let report = load_existing_meta(&peaks_root, file_id);
        return Ok(status_from_disk(&peaks_root, file_id, report.as_ref()));
    }

    if let Some(_lock) = try_acquire_peaks_lock(&peaks_root, file_id)? {
        let cache_complete = all_peak_levels_exist(&peaks_root, file_id);
        let stale_opts = if cache_complete {
            stale_check_options_cache_fresh(&peaks_root, file_id, &audio, media_duration_sec)
        } else {
            stale_check_options(&audio, media_duration_sec)
        };
        if !invalidate_peaks_if_stale_with_options(&peaks_root, file_id, &audio, force, stale_opts)?
            && cache_complete
        {
            let report = load_existing_meta(&peaks_root, file_id);
            return Ok(status_from_disk(&peaks_root, file_id, report.as_ref()));
        }

        spawn_peaks_generation(
            st.clone(),
            audio.clone(),
            peaks_root.clone(),
            file_id.to_string(),
            _lock,
        );
        Ok(status_from_disk_with_probe(
            &peaks_root,
            file_id,
            None,
            Some(&audio),
            media_duration_sec,
        ))
    } else if depth < MAX_ENSURE_RETRY_DEPTH
        && !peaks_generation_in_progress(&peaks_root, file_id)
        && !all_peak_levels_exist(&peaks_root, file_id)
    {
        // Lock vanished between try_acquire and now (abandoned holder) — retry once.
        ensure_waveform_peaks_sync_with_depth(
            st,
            project_id,
            file_id,
            true,
            media_duration_sec,
            depth + 1,
        )
    } else {
        // Live holder: soft-join. Do not block spawn_blocking for up to 15m —
        // frontend polls `waveform_peaks_status` with a duration-scaled budget.
        Ok(status_from_disk_with_probe(
            &peaks_root,
            file_id,
            load_existing_meta(&peaks_root, file_id).as_ref(),
            Some(&audio),
            media_duration_sec,
        ))
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

//! Release waveform readiness probe (filesystem + bundled ffmpeg).

use std::path::Path;

use serde::Serialize;

use super::waveform_peaks::{all_peak_levels_exist, load_peaks_meta, peaks_dir, PEAK_LEVELS};
use super::waveform_peaks_ffmpeg::resolve_ffmpeg_command;
use crate::DbState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WaveformReleaseProbe {
    pub audio_path: String,
    pub audio_exists: bool,
    pub peaks_dir: String,
    pub peaks_complete: bool,
    pub peaks_duration_sec: Option<f64>,
    pub bundled_ffmpeg: String,
    pub bundled_ffmpeg_exists: bool,
}

#[tauri::command]
pub fn waveform_release_probe(
    state: tauri::State<DbState>,
    project_id: String,
    file_id: String,
) -> Result<WaveformReleaseProbe, String> {
    let st = state.inner();
    let conn = super::utils::open_db(st)?;
    let audio_path: Option<String> = conn
        .query_row(
            "SELECT audio_path FROM files WHERE id = ?1 AND project_id = ?2",
            rusqlite::params![file_id, project_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let audio_path = audio_path.filter(|p| !p.trim().is_empty()).ok_or("文件无音频路径")?;
    let audio = Path::new(&audio_path);
    let peaks_root = peaks_dir(&st.root.join("projects").join(&project_id));
    let peaks_complete = all_peak_levels_exist(&peaks_root, &file_id);
    let peaks_duration_sec = load_peaks_meta(&peaks_root, &file_id).map(|r| r.duration_sec);
    let ffmpeg = resolve_ffmpeg_command();

    Ok(WaveformReleaseProbe {
        audio_exists: audio.is_file(),
        peaks_dir: peaks_root.to_string_lossy().into_owned(),
        peaks_complete,
        peaks_duration_sec,
        bundled_ffmpeg: ffmpeg.to_string_lossy().into_owned(),
        bundled_ffmpeg_exists: ffmpeg.is_file(),
        audio_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::waveform_peaks::peak_file_path;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn probe_reports_peaks_complete_when_all_levels_exist() {
        let root = std::env::temp_dir().join(format!("rushi-wf-probe-{}", Uuid::new_v4()));
        let project_id = "p1";
        let file_id = "f1";
        let peaks_root = peaks_dir(&root.join("projects").join(project_id));
        fs::create_dir_all(&peaks_root).unwrap();
        for (level, _) in PEAK_LEVELS {
            fs::write(peak_file_path(&peaks_root, file_id, level), b"x").unwrap();
        }
        assert!(all_peak_levels_exist(&peaks_root, file_id));
        let _ = fs::remove_dir_all(root);
    }
}

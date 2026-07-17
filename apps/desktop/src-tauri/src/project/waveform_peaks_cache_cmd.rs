use super::project_storage::project_storage_dir;
use super::utils::open_db;
use super::waveform_peaks::{peaks_dir, peaks_disk_bytes_for_file};
use super::waveform_peaks_cmd::cleanup_peaks_for_file;
use super::waveform_peaks_gc::{
    gc_orphan_waveform_peaks, inspect_waveform_peaks_cache, WaveformPeaksCacheInfo,
    WaveformPeaksGcReport,
};
use crate::DbState;
use rusqlite::params;
use serde::Serialize;
use std::ops::Deref;
use tauri::State;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ClearOrphanWaveformPeaksResult {
    pub cache: WaveformPeaksCacheInfo,
    pub gc: WaveformPeaksGcReport,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ClearWaveformPeaksForFileResult {
    pub freed_bytes: u64,
}

#[tauri::command]
pub fn waveform_peaks_cache_info(state: State<DbState>) -> Result<WaveformPeaksCacheInfo, String> {
    inspect_waveform_peaks_cache(state.deref())
}

#[tauri::command]
pub fn clear_orphan_waveform_peaks_cache(
    state: State<DbState>,
) -> Result<ClearOrphanWaveformPeaksResult, String> {
    let st = state.deref();
    let gc = gc_orphan_waveform_peaks(st)?;
    let cache = inspect_waveform_peaks_cache(st)?;
    Ok(ClearOrphanWaveformPeaksResult { cache, gc })
}

#[tauri::command]
pub fn clear_waveform_peaks_for_file(
    state: State<DbState>,
    project_id: String,
    file_id: String,
) -> Result<ClearWaveformPeaksForFileResult, String> {
    let st = state.deref();
    let conn = open_db(st)?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE id = ?1 AND project_id = ?2",
            params![file_id, project_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("文件不存在或不属于当前项目".to_string());
    }

    let peaks_root = peaks_dir(
        &crate::media_base_dir::media_project_dir(st, &project_id)
            .unwrap_or_else(|_| project_storage_dir(&st.root, &project_id)),
    );
    let freed_bytes = peaks_disk_bytes_for_file(&peaks_root, &file_id);
    cleanup_peaks_for_file(st, &project_id, &file_id);
    Ok(ClearWaveformPeaksForFileResult { freed_bytes })
}

use tauri::ipc::Channel;
use tauri::State;

use crate::project::audio_container_normalize::normalize_project_audio_in_place;
use crate::project::utils::{
    append_desktop_log_line, canonicalize_audio_storage_path, open_db,
    resolve_audio_path_under_root,
};
use crate::DbState;
use rusqlite::params;
use std::path::PathBuf;

use super::engine::{NativeAudioState, PlayerHandle};
use super::types::{NativeAudioEvent, NativeAudioSnapshot};

#[tauri::command]
pub async fn native_audio_load(
    db: State<'_, DbState>,
    audio: State<'_, NativeAudioState>,
    path: String,
    duration_sec: f64,
    on_event: Channel<NativeAudioEvent>,
) -> Result<NativeAudioSnapshot, String> {
    let root = db.root.clone();
    let st = db.inner().clone();
    let path_for_resolve = path.clone();

    let (resolved, report) = tauri::async_runtime::spawn_blocking(move || {
        let resolved = resolve_audio_path_under_root(&root, &path_for_resolve)?;
        let report = normalize_project_audio_in_place(&resolved, Some(&st))?;
        Ok::<(PathBuf, _), String>((resolved, report))
    })
    .await
    .map_err(|e| format!("音频规范化任务失败: {e}"))??;

    if report.path != resolved {
        let old = canonicalize_audio_storage_path(&resolved).unwrap_or_else(|_| path.clone());
        let new_str = canonicalize_audio_storage_path(&report.path)?;
        let conn = open_db(db.inner())?;
        let updated = conn
            .execute(
                "UPDATE files SET audio_path = ?1, updated_at_ms = ?2 WHERE audio_path = ?3",
                params![&new_str, crate::project::utils::now_ms(), &old],
            )
            .map_err(|e| format!("更新音频路径失败: {e}"))?;
        if updated == 0 {
            append_desktop_log_line(
                db.inner(),
                &format!(
                    "audio_normalize path_update unmatched old={} new={}",
                    PathBuf::from(&old)
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("?"),
                    PathBuf::from(&new_str)
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("?")
                ),
            );
            return Err(
                "音频已重封装为 WAV，但数据库路径未更新（未匹配到记录）。请重新导入该文件。"
                    .to_string(),
            );
        }
    }

    let handle = PlayerHandle::open(report.path, duration_sec, on_event)?;
    let snap = handle.snapshot();
    audio.replace(handle)?;
    Ok(snap)
}

#[tauri::command]
pub fn native_audio_play(audio: State<'_, NativeAudioState>) -> Result<(), String> {
    audio.with_player(|p| p.play())
}

#[tauri::command]
pub fn native_audio_pause(audio: State<'_, NativeAudioState>) -> Result<(), String> {
    audio.with_player(|p| p.pause())
}

#[tauri::command]
pub fn native_audio_seek(audio: State<'_, NativeAudioState>, time_sec: f64) -> Result<(), String> {
    audio.with_player(|p| p.seek(time_sec))
}

#[tauri::command]
pub fn native_audio_set_rate(audio: State<'_, NativeAudioState>, rate: f32) -> Result<(), String> {
    audio.with_player(|p| p.set_rate(rate))
}

/// Debug/diagnostic snapshot; playback UI should prefer Channel events.
#[tauri::command]
pub fn native_audio_snapshot(
    audio: State<'_, NativeAudioState>,
) -> Result<NativeAudioSnapshot, String> {
    audio.with_player(|p| Ok(p.snapshot()))
}

#[tauri::command]
pub fn native_audio_stop(audio: State<'_, NativeAudioState>) -> Result<(), String> {
    audio.stop();
    Ok(())
}

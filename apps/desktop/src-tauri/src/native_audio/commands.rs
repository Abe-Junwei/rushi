use tauri::ipc::Channel;
use tauri::State;

use crate::project::utils::resolve_audio_path_under_root;
use crate::DbState;

use super::engine::{NativeAudioState, PlayerHandle};
use super::types::{NativeAudioEvent, NativeAudioSnapshot};

#[tauri::command]
pub fn native_audio_load(
    db: State<'_, DbState>,
    audio: State<'_, NativeAudioState>,
    path: String,
    duration_sec: f64,
    on_event: Channel<NativeAudioEvent>,
) -> Result<NativeAudioSnapshot, String> {
    let resolved = resolve_audio_path_under_root(&db.root, &path)?;
    let handle = PlayerHandle::open(resolved, duration_sec, on_event)?;
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

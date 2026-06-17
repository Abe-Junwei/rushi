const AUDIO_PICKER_EXTENSIONS: &[&str] = &[
    "wav", "mp3", "m4a", "aac", "flac", "ogg", "mp4", "webm", "mov", "caf", "aiff",
];

fn audio_file_dialog() -> rfd::FileDialog {
    rfd::FileDialog::new().add_filter("音视频", AUDIO_PICKER_EXTENSIONS)
}

#[tauri::command]
pub fn pick_audio_path() -> Result<Option<String>, String> {
    let picked = audio_file_dialog().pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_audio_paths() -> Result<Vec<String>, String> {
    let picked = audio_file_dialog().pick_files();
    Ok(picked
        .unwrap_or_default()
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn pick_text_path() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("文本文件", &["txt", "srt"])
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn ui_desktop_log(
    state: tauri::State<crate::DbState>,
    level: String,
    message: String,
) -> Result<(), String> {
    use std::ops::Deref;

    let lvl = match level.as_str() {
        "ERROR" => "ERROR",
        "WARN" => "WARN",
        _ => "INFO",
    };
    let clean = message.replace(['\n', '\r'], " ");
    super::utils::append_desktop_log_line(state.deref(), &format!("{lvl} ui {clean}"));
    Ok(())
}

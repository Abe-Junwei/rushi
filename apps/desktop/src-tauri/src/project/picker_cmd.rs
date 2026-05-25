#[tauri::command]
pub fn pick_audio_path() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter(
            "音视频",
            &[
                "wav", "mp3", "m4a", "aac", "flac", "ogg", "mp4", "webm", "mov", "caf", "aiff",
            ],
        )
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_text_path() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("文本文件", &["txt", "srt"])
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

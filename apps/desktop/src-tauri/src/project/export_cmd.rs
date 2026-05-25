use crate::DbState;
use std::fs;
use std::ops::Deref;
use std::path::Path;
use std::process::Command;
use tauri::State;

use super::project_bundle_cmd::{export_project_bundle_to_path, import_project_bundle_from_path};
use super::types::{ProjectDetail, SegmentDto};

/// 弹出系统「另存为」并写入 UTF-8 文本（Tauri WebView 内程序化 `<a download>` 常无效果）。
#[tauri::command]
pub fn export_text_file(
    default_filename: String,
    content: String,
) -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_file_name(&default_filename)
        .save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    if path.exists() {
        return Err("目标文件已存在，请另选文件名或先删除该文件。".into());
    }
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {e}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn export_project_bundle(
    state: State<DbState>,
    project_id: String,
    file_id: String,
    default_filename: String,
    segments: Vec<SegmentDto>,
) -> Result<Option<String>, String> {
    let st: &DbState = state.deref();
    let picked = rfd::FileDialog::new()
        .add_filter("ZIP", &["zip"])
        .set_file_name(&default_filename)
        .save_file();
    let Some(zip_path) = picked else {
        return Ok(None);
    };
    export_project_bundle_to_path(st, &project_id, &file_id, &zip_path, segments).map(Some)
}

#[tauri::command]
pub fn import_project_bundle(state: State<DbState>) -> Result<Option<ProjectDetail>, String> {
    let st: &DbState = state.deref();
    let picked = rfd::FileDialog::new()
        .add_filter("ZIP", &["zip"])
        .pick_file();
    let Some(zip_path) = picked else {
        return Ok(None);
    };
    import_project_bundle_from_path(st, &zip_path).map(Some)
}

fn reveal_path_in_file_manager(path: &Path) -> Result<(), String> {
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 在系统文件管理器中打开应用数据根目录（含 `models/`、`rushi.sqlite3` 等）。
#[tauri::command]
pub fn open_app_data_folder(state: State<DbState>) -> Result<(), String> {
    let st: &DbState = state.deref();
    reveal_path_in_file_manager(&st.root)
}

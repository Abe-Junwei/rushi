use crate::command_error::{CommandError, CommandErrorDto, CommandResultExt};
use crate::DbState;
use std::fs;
use std::ops::Deref;
use std::path::Path;
use std::process::Command;
use tauri::State;

use super::library_bundle_cmd::{
    export_library_bundle_to_path, import_library_bundle_from_path, LIBRARY_BUNDLE_KIND,
};
use super::project_bundle_cmd::{
    export_project_bundle_to_path, import_project_bundle_from_path, peek_exchange_bundle_kind,
    PROJECT_BUNDLE_KIND,
};
use super::types::{ProjectDetail, SegmentDto};

/// 弹出系统「另存为」并写入 UTF-8 文本（Tauri WebView 内程序化 `<a download>` 常无效果）。
#[tauri::command]
pub async fn export_text_file(
    default_filename: String,
    content: String,
) -> Result<Option<String>, CommandErrorDto> {
    let picked = tauri::async_runtime::spawn_blocking({
        let default_filename = default_filename.clone();
        move || {
            rfd::FileDialog::new()
                .set_file_name(&default_filename)
                .save_file()
        }
    })
    .await
    .map_err(|e| {
        CommandError::ExportTextFile {
            detail: e.to_string(),
        }
        .to_dto()
    })?;
    let Some(path) = picked else {
        return Ok(None);
    };
    if path.exists() {
        return Err(CommandError::TargetFileExists.to_dto());
    }
    tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, CommandError> {
        fs::write(&path, content).map_err(CommandError::WriteFile)?;
        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| {
        CommandError::ExportTextFile {
            detail: e.to_string(),
        }
        .to_dto()
    })?
    .map_command_err_dto()
}

#[tauri::command]
pub async fn export_project_bundle(
    state: State<'_, DbState>,
    project_id: String,
    file_id: String,
    default_filename: String,
    segments: Vec<SegmentDto>,
) -> Result<Option<String>, CommandErrorDto> {
    let st = state.inner().clone();
    let picked = tauri::async_runtime::spawn_blocking({
        let default_filename = default_filename.clone();
        move || {
            rfd::FileDialog::new()
                .add_filter("ZIP", &["zip"])
                .set_file_name(&default_filename)
                .save_file()
        }
    })
    .await
    .map_err(|e| {
        CommandError::ExportProjectBundle {
            detail: e.to_string(),
        }
        .to_dto()
    })?;
    let Some(zip_path) = picked else {
        return Ok(None);
    };
    tauri::async_runtime::spawn_blocking(move || {
        export_project_bundle_to_path(&st, &project_id, &file_id, &zip_path, segments, true)
            .map(Some)
    })
    .await
    .map_err(|e| {
        CommandError::ExportProjectBundle {
            detail: e.to_string(),
        }
        .to_dto()
    })?
    .map_command_err_dto()
}

#[tauri::command]
pub async fn export_library_bundle(
    state: State<'_, DbState>,
    default_filename: String,
    // When set, flush override applies to this project only.
    override_project_id: Option<String>,
    override_file_id: Option<String>,
    override_segments: Vec<SegmentDto>,
) -> Result<Option<String>, CommandErrorDto> {
    let st = state.inner().clone();
    let picked = tauri::async_runtime::spawn_blocking({
        let default_filename = default_filename.clone();
        move || {
            rfd::FileDialog::new()
                .add_filter("ZIP", &["zip"])
                .set_file_name(&default_filename)
                .save_file()
        }
    })
    .await
    .map_err(|e| {
        CommandError::ExportProjectBundle {
            detail: e.to_string(),
        }
        .to_dto()
    })?;
    let Some(zip_path) = picked else {
        return Ok(None);
    };
    tauri::async_runtime::spawn_blocking(move || {
        export_library_bundle_to_path(
            &st,
            &zip_path,
            override_project_id.as_deref(),
            override_file_id.as_deref(),
            override_segments,
        )
        .map(Some)
    })
    .await
    .map_err(|e| {
        CommandError::ExportProjectBundle {
            detail: e.to_string(),
        }
        .to_dto()
    })?
    .map_command_err_dto()
}

#[tauri::command]
pub async fn import_project_bundle(
    state: State<'_, DbState>,
) -> Result<Option<ProjectDetail>, CommandErrorDto> {
    let st = state.inner().clone();
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("ZIP", &["zip"])
            .pick_file()
    })
    .await
    .map_err(|e| {
        CommandError::ImportProjectBundle {
            detail: e.to_string(),
        }
        .to_dto()
    })?;
    let Some(zip_path) = picked else {
        return Ok(None);
    };
    tauri::async_runtime::spawn_blocking(move || {
        let kind = peek_exchange_bundle_kind(&zip_path)?;
        match kind.as_str() {
            k if k == PROJECT_BUNDLE_KIND => {
                import_project_bundle_from_path(&st, &zip_path).map(Some)
            }
            k if k == LIBRARY_BUNDLE_KIND => {
                import_library_bundle_from_path(&st, &zip_path).map(Some)
            }
            _ => Err(CommandError::BundleUnsupportedKind),
        }
    })
    .await
    .map_err(|e| {
        CommandError::ImportProjectBundle {
            detail: e.to_string(),
        }
        .to_dto()
    })?
    .map_command_err_dto()
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

pub(crate) fn open_folder_in_file_manager(path: &Path) -> Result<(), String> {
    reveal_path_in_file_manager(path)
}

/// Reveal `path` selected in the system file manager (Finder / Explorer).
pub(crate) fn reveal_file_selected_in_file_manager(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Err(format!("文件不存在: {}", path.display()));
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(parent) = path.parent() {
            reveal_path_in_file_manager(parent)?;
        } else {
            return Err("无法打开文件所在目录。".into());
        }
    }
    Ok(())
}

/// 在系统文件管理器中打开应用数据根目录（含 `models/`、`rushi.sqlite3` 等）。
#[tauri::command]
pub fn open_app_data_folder(state: State<DbState>) -> Result<(), String> {
    let st: &DbState = state.deref();
    reveal_path_in_file_manager(&st.root)
}

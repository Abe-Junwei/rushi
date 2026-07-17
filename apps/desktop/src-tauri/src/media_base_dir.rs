//! Media base directory pref (Zotero-style split: DB local, media relocatable).
//!
//! Empty pref = default to `DbState.root` (unchanged layout). Custom pref is an absolute
//! directory that may live on a consumer cloud sync folder; SQLite stays under `DbState.root`.

use crate::DbState;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

const PREF_REL: &str = "prefs/media_base_dir.txt";

pub fn pref_path(st: &DbState) -> PathBuf {
    st.root.join(PREF_REL)
}

/// Raw pref text (trimmed). Empty means default (`DbState.root`).
pub fn read_media_base_pref_raw(st: &DbState) -> String {
    let p = pref_path(st);
    std::fs::read_to_string(&p)
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

pub fn write_media_base_pref(st: &DbState, absolute_or_empty: &str) -> Result<(), String> {
    let trimmed = absolute_or_empty.trim();
    let path = pref_path(st);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("无法创建 prefs 目录：{e}"))?;
    }
    let tmp = path.with_extension("txt.tmp");
    if trimmed.is_empty() {
        std::fs::write(&tmp, "\n").map_err(|e| format!("无法写入媒体基准偏好：{e}"))?;
    } else {
        let pb = PathBuf::from(trimmed);
        if !pb.is_dir() {
            return Err("媒体基准目录不存在或不是文件夹。".into());
        }
        let can = std::fs::canonicalize(&pb).map_err(|e| format!("无法解析媒体基准目录：{e}"))?;
        std::fs::write(&tmp, format!("{}\n", can.display()))
            .map_err(|e| format!("无法写入媒体基准偏好：{e}"))?;
    }
    std::fs::rename(&tmp, &path).map_err(|e| format!("无法写入媒体基准偏好：{e}"))
}

/// Resolved media base directory (always absolute, exists or creatable as root).
pub fn resolve_media_base(st: &DbState) -> Result<PathBuf, String> {
    let raw = read_media_base_pref_raw(st);
    if raw.is_empty() {
        return Ok(st.root.clone());
    }
    let pb = PathBuf::from(&raw);
    if !pb.is_dir() {
        return Err(format!(
            "已配置的媒体基准目录不可用：{raw}。请在「偏好设置 → 内容库位置」重新选择，或恢复默认。"
        ));
    }
    std::fs::canonicalize(&pb).map_err(|e| format!("无法解析媒体基准目录：{e}"))
}

pub fn audio_project_dir(media_base: &Path, project_id: &str) -> PathBuf {
    media_base.join("projects").join(project_id)
}

/// Persist path for `files.audio_path`: relative to media base when under it (portable `/` sep).
pub fn persist_audio_storage_path(media_base: &Path, file: &Path) -> Result<String, String> {
    let file_can = std::fs::canonicalize(file)
        .map_err(|e| format!("无法规范化音频路径 ({}): {e}", file.display()))?;
    let base_can =
        std::fs::canonicalize(media_base).map_err(|e| format!("无法规范化媒体基准目录: {e}"))?;
    if let Ok(rel) = file_can.strip_prefix(&base_can) {
        let s = rel.to_string_lossy().replace('\\', "/");
        if s.is_empty() {
            return Err("音频路径无效（相对段为空）".into());
        }
        return Ok(s);
    }
    // Fallback: absolute (should be rare)
    Ok(file_can.to_string_lossy().to_string())
}

fn path_is_absolute_storage(raw: &str) -> bool {
    let p = Path::new(raw);
    if p.is_absolute() {
        return true;
    }
    // Windows drive paths that Path::is_absolute may still treat as absolute on Windows.
    let bytes = raw.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

fn under_canonical_root(root: &Path, file_can: &Path) -> bool {
    let Ok(root_can) = std::fs::canonicalize(root) else {
        return false;
    };
    file_can.strip_prefix(&root_can).is_ok()
}

/// Dual-read resolve: relative → join media base; absolute → must sit under media base or legacy app_data root.
pub fn resolve_audio_path(st: &DbState, raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("音频路径为空".into());
    }
    let media_base = resolve_media_base(st)?;
    let candidate = if path_is_absolute_storage(trimmed) {
        PathBuf::from(trimmed)
    } else {
        let rel = trimmed.trim_start_matches(['/', '\\']);
        media_base.join(rel)
    };

    let sm = std::fs::symlink_metadata(&candidate)
        .map_err(|e| format!("无法读取音频文件元数据: {e}"))?;
    if sm.file_type().is_symlink() {
        return Err("拒绝读取：音频文件为符号链接。".into());
    }
    let file_can =
        std::fs::canonicalize(&candidate).map_err(|e| format!("无法解析音频文件路径: {e}"))?;
    let under_media = under_canonical_root(&media_base, &file_can);
    let under_legacy = under_canonical_root(&st.root, &file_can);
    if !under_media && !under_legacy {
        return Err("拒绝读取：音频文件不在媒体基准目录或应用数据根之下。".into());
    }
    if !file_can.is_file() {
        return Err("音频文件不存在或不是普通文件".into());
    }
    Ok(file_can)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaBaseDirInfo {
    /// Resolved absolute media base (default = app data root).
    pub media_base_dir: String,
    /// True when pref is non-empty (user override).
    pub is_custom: bool,
    /// Local DB / models root (never put on cloud sync).
    pub app_data_root: String,
}

#[tauri::command]
pub fn get_media_base_dir_info(state: State<'_, DbState>) -> Result<MediaBaseDirInfo, String> {
    let st = state.inner();
    let raw = read_media_base_pref_raw(st);
    let media_base = resolve_media_base(st)?;
    Ok(MediaBaseDirInfo {
        media_base_dir: media_base.to_string_lossy().to_string(),
        is_custom: !raw.is_empty(),
        app_data_root: st.root.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_app_data_root_path(state: State<'_, DbState>) -> Result<String, String> {
    Ok(state.inner().root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_media_base_dir_pref(
    path: Option<String>,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<MediaBaseDirInfo, String> {
    let st = state.inner();
    let value = path.unwrap_or_default();
    write_media_base_pref(st, &value)?;
    let info = get_media_base_dir_info(state)?;
    crate::project::asset_scope::allow_media_base_directory(&app, Path::new(&info.media_base_dir));
    Ok(info)
}

#[tauri::command]
pub fn pick_media_base_dir(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<Option<MediaBaseDirInfo>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择媒体基准目录（可放网盘；数据库仍在本机）")
        .pick_folder();
    let Some(dir) = picked else {
        return Ok(None);
    };
    write_media_base_pref(state.inner(), &dir.to_string_lossy())?;
    let info = get_media_base_dir_info(state)?;
    crate::project::asset_scope::allow_media_base_directory(&app, Path::new(&info.media_base_dir));
    Ok(Some(info))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    fn temp_state() -> (PathBuf, DbState) {
        let tmp = std::env::temp_dir().join(format!("rushi-media-base-{}", Uuid::new_v4()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let st = DbState::open_test_db_at(tmp.clone(), tmp.join("app.db"));
        (tmp, st)
    }

    #[test]
    fn empty_pref_defaults_to_app_root() {
        let (tmp, st) = temp_state();
        let base = resolve_media_base(&st).unwrap();
        assert_eq!(
            fs::canonicalize(&base).unwrap(),
            fs::canonicalize(&st.root).unwrap()
        );
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn persist_and_resolve_relative_roundtrip() {
        let (tmp, st) = temp_state();
        let media = tmp.join("media-cloud");
        fs::create_dir_all(media.join("projects").join("p1")).unwrap();
        write_media_base_pref(&st, media.to_str().unwrap()).unwrap();
        let base = resolve_media_base(&st).unwrap();
        let audio = base.join("projects").join("p1").join("f1.wav");
        fs::write(&audio, b"wav").unwrap();
        let stored = persist_audio_storage_path(&base, &audio).unwrap();
        assert!(!path_is_absolute_storage(&stored));
        assert!(stored.starts_with("projects/"));
        let resolved = resolve_audio_path(&st, &stored).unwrap();
        assert!(resolved.is_file());
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn legacy_absolute_under_app_root_still_resolves() {
        let (tmp, st) = temp_state();
        let audio = st.root.join("projects").join("legacy").join("a.wav");
        fs::create_dir_all(audio.parent().unwrap()).unwrap();
        fs::write(&audio, b"wav").unwrap();
        let abs = fs::canonicalize(&audio).unwrap();
        let resolved = resolve_audio_path(&st, abs.to_str().unwrap()).unwrap();
        assert_eq!(resolved, abs);
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn rejects_outside_both_roots() {
        let (tmp, st) = temp_state();
        let outside = std::env::temp_dir().join(format!("rushi-media-out-{}", Uuid::new_v4()));
        fs::write(&outside, b"x").unwrap();
        let err = resolve_audio_path(&st, outside.to_str().unwrap()).unwrap_err();
        assert!(err.contains("媒体基准") || err.contains("应用数据根"));
        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(tmp);
    }
}

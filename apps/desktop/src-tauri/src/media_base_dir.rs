//! Media base directory pref (Zotero-style split: DB local, media relocatable).
//!
//! Empty pref = default to `DbState.root` (unchanged layout). Custom pref is an absolute
//! directory that may live on a consumer cloud sync folder; SQLite stays under `DbState.root`.

use crate::DbState;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

const PREF_REL: &str = "prefs/media_base_dir.txt";
const RELOCATE_ALLOW_REL: &str = "prefs/media_base_relocate_allow.txt";

/// User-facing absolute path: strip Windows `\\?\` / `\\?\UNC\` from `canonicalize`.
pub(crate) fn path_to_user_string(path: &Path) -> String {
    strip_windows_verbatim_prefix(&path.to_string_lossy())
}

/// Strip `\\?\` / `\\?\UNC\` from a path string (pref / DB may still store legacy verbatim form).
pub(crate) fn strip_windows_verbatim_prefix(raw: &str) -> String {
    let s = raw.trim();
    #[cfg(windows)]
    {
        if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{rest}");
        }
        if let Some(rest) = s.strip_prefix(r"\\?\") {
            return rest.to_string();
        }
    }
    s.to_string()
}

pub fn pref_path(st: &DbState) -> PathBuf {
    st.root.join(PREF_REL)
}

/// Raw pref text (trimmed, verbatim prefix stripped). Empty means default (`DbState.root`).
pub fn read_media_base_pref_raw(st: &DbState) -> String {
    let p = pref_path(st);
    let raw = std::fs::read_to_string(&p)
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    if raw.is_empty() {
        return raw;
    }
    let healed = strip_windows_verbatim_prefix(&raw);
    // Lazily rewrite prefs written before verbatim stripping (e.g. `\\?\D:\…`).
    if healed != raw {
        let _ = std::fs::write(&p, format!("{healed}\n"));
    }
    healed
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
        std::fs::write(&tmp, format!("{}\n", path_to_user_string(&can)))
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

/// Project directory for audio + peaks under the resolved media base.
pub fn media_project_dir(st: &DbState, project_id: &str) -> Result<PathBuf, String> {
    let base = resolve_media_base(st)?;
    Ok(audio_project_dir(&base, project_id))
}

pub fn relocate_allow_pref_path(st: &DbState) -> PathBuf {
    st.root.join(RELOCATE_ALLOW_REL)
}

pub fn read_relocate_allow_root(st: &DbState) -> Option<PathBuf> {
    let raw = std::fs::read_to_string(relocate_allow_pref_path(st))
        .ok()?
        .trim()
        .to_string();
    if raw.is_empty() {
        return None;
    }
    let pb = PathBuf::from(raw);
    pb.is_dir().then_some(pb)
}

pub fn write_relocate_allow_root(st: &DbState, dir: Option<&Path>) -> Result<(), String> {
    let path = relocate_allow_pref_path(st);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("无法创建 prefs 目录：{e}"))?;
    }
    match dir {
        None => {
            let _ = std::fs::remove_file(&path);
            Ok(())
        }
        Some(d) => {
            let can = std::fs::canonicalize(d).map_err(|e| format!("无法解析搬迁目标：{e}"))?;
            std::fs::write(&path, format!("{}\n", path_to_user_string(&can)))
                .map_err(|e| format!("无法写入搬迁临时偏好：{e}"))
        }
    }
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
    Ok(path_to_user_string(&file_can))
}

pub(crate) fn path_is_absolute_storage(raw: &str) -> bool {
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

const CLOUD_PLACEHOLDER_HINT: &str =
    "音频尚未完整下载到本机（网盘「按需」占位）。请在文件资源管理器中对该文件或文件夹选择「始终保留在此设备」，待同步完成后再试。";

/// Windows OneDrive / cloud filer: not fully present locally.
#[cfg(windows)]
fn looks_like_cloud_placeholder(meta: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS: u32 = 0x0040_0000;
    const FILE_ATTRIBUTE_RECALL_ON_OPEN: u32 = 0x0004_0000;
    const FILE_ATTRIBUTE_UNPINNED: u32 = 0x0010_0000;
    const FILE_ATTRIBUTE_OFFLINE: u32 = 0x0000_1000;
    let attrs = meta.file_attributes();
    (attrs & FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS) != 0
        || (attrs & FILE_ATTRIBUTE_RECALL_ON_OPEN) != 0
        || ((attrs & FILE_ATTRIBUTE_UNPINNED) != 0 && (attrs & FILE_ATTRIBUTE_OFFLINE) != 0)
}

#[cfg(not(windows))]
fn looks_like_cloud_placeholder(_meta: &std::fs::Metadata) -> bool {
    false
}

fn map_access_io_error(err: &std::io::Error, candidate: &Path) -> String {
    if let Ok(meta) = std::fs::symlink_metadata(candidate) {
        if looks_like_cloud_placeholder(&meta) {
            return CLOUD_PLACEHOLDER_HINT.into();
        }
    }
    let msg = err.to_string();
    let lower = msg.to_ascii_lowercase();
    if lower.contains("cloud")
        || lower.contains("offline")
        || lower.contains("0x8007016a")
        || lower.contains("0x8007016A")
    {
        return CLOUD_PLACEHOLDER_HINT.into();
    }
    format!("无法解析音频文件路径: {msg}")
}

fn resolve_candidate_under_roots(
    st: &DbState,
    media_base: &Path,
    candidate: &Path,
) -> Result<PathBuf, String> {
    let sm =
        std::fs::symlink_metadata(candidate).map_err(|e| map_access_io_error(&e, candidate))?;
    let was_symlink = sm.file_type().is_symlink();
    if looks_like_cloud_placeholder(&sm) {
        return Err(CLOUD_PLACEHOLDER_HINT.into());
    }

    let file_can =
        std::fs::canonicalize(candidate).map_err(|e| map_access_io_error(&e, candidate))?;
    let under_media = under_canonical_root(media_base, &file_can);
    let under_legacy = under_canonical_root(&st.root, &file_can);
    let under_relocate =
        read_relocate_allow_root(st).is_some_and(|extra| under_canonical_root(&extra, &file_can));
    if !under_media && !under_legacy && !under_relocate {
        if was_symlink {
            return Err("拒绝读取：符号链接目标不在媒体基准目录或应用数据根之下。".into());
        }
        return Err("拒绝读取：音频文件不在媒体基准目录或应用数据根之下。".into());
    }
    if !file_can.is_file() {
        return Err("音频文件不存在或不是普通文件".into());
    }
    Ok(file_can)
}

/// Dual-read resolve: relative → join media base (and relocate-allow root while a move is in progress);
/// absolute → must sit under media base, app_data, or relocate-allow.
/// Symlinks are allowed only when the canonical target stays under an allowed root.
pub fn resolve_audio_path(st: &DbState, raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = strip_windows_verbatim_prefix(raw_path);
    if trimmed.is_empty() {
        return Err("音频路径为空".into());
    }
    let media_base = resolve_media_base(st)?;
    if path_is_absolute_storage(&trimmed) {
        return resolve_candidate_under_roots(st, &media_base, Path::new(&trimmed));
    }

    let rel = trimmed.trim_start_matches(['/', '\\']);
    // Prefer current media base (source during relocate). Fall back to relocate-allow
    // so mid-move relative paths under the destination still resolve.
    let mut candidates = vec![media_base.join(rel)];
    if let Some(allow) = read_relocate_allow_root(st) {
        let under_allow = allow.join(rel);
        if under_allow != candidates[0] {
            candidates.push(under_allow);
        }
    }

    let mut last_err = String::from("无法解析音频文件路径");
    for candidate in candidates {
        match resolve_candidate_under_roots(st, &media_base, &candidate) {
            Ok(p) => return Ok(p),
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
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
        media_base_dir: path_to_user_string(&media_base),
        is_custom: !raw.is_empty(),
        app_data_root: path_to_user_string(&st.root),
    })
}

#[tauri::command]
pub fn get_app_data_root_path(state: State<'_, DbState>) -> Result<String, String> {
    Ok(path_to_user_string(&state.inner().root))
}

/// Legacy command: empty-library pref switch only. When media exists, refuse (use relocate UI).
#[tauri::command]
pub fn set_media_base_dir_pref(
    path: Option<String>,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<MediaBaseDirInfo, String> {
    crate::media_base_relocate::commit_media_base_dir_change_inner(path, false, &app, state.inner())
}

/// Legacy command: pick + empty-library pref switch only (no silent relocate bypass).
#[tauri::command]
pub fn pick_media_base_dir(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<Option<MediaBaseDirInfo>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择媒体存放目录")
        .pick_folder();
    let Some(dir) = picked else {
        return Ok(None);
    };
    let path = path_to_user_string(&dir);
    Ok(Some(crate::media_base_relocate::commit_media_base_dir_change_inner(
        Some(path),
        false,
        &app,
        state.inner(),
    )?))
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

    #[test]
    fn path_to_user_string_strips_windows_verbatim_prefix() {
        #[cfg(windows)]
        {
            assert_eq!(path_to_user_string(Path::new(r"\\?\D:\转录")), r"D:\转录");
            assert_eq!(
                path_to_user_string(Path::new(r"\\?\UNC\server\share\a")),
                r"\\server\share\a"
            );
            assert_eq!(strip_windows_verbatim_prefix(r"\\?\D:\转录"), r"D:\转录");
        }
        assert_eq!(path_to_user_string(Path::new(r"D:\转录")), r"D:\转录");
    }

    #[test]
    fn write_pref_stores_user_facing_path_without_verbatim_prefix() {
        let (tmp, st) = temp_state();
        let media = tmp.join("media-cloud");
        fs::create_dir_all(&media).unwrap();
        write_media_base_pref(&st, media.to_str().unwrap()).unwrap();
        let raw = read_media_base_pref_raw(&st);
        assert!(!raw.is_empty());
        assert!(
            !raw.contains(r"\\?\"),
            "pref should not store verbatim prefix: {raw}"
        );
        let shown = path_to_user_string(&resolve_media_base(&st).unwrap());
        assert!(
            !shown.contains(r"\\?\"),
            "UI path should not show verbatim prefix: {shown}"
        );
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn cloud_placeholder_hint_mentions_keep_on_device() {
        assert!(CLOUD_PLACEHOLDER_HINT.contains("始终保留"));
        assert!(CLOUD_PLACEHOLDER_HINT.contains("网盘") || CLOUD_PLACEHOLDER_HINT.contains("按需"));
    }

    #[cfg(unix)]
    #[test]
    fn symlink_inside_media_base_resolves() {
        let (tmp, st) = temp_state();
        let media = tmp.join("media");
        let proj = media.join("projects").join("p1");
        fs::create_dir_all(&proj).unwrap();
        write_media_base_pref(&st, media.to_str().unwrap()).unwrap();
        let target = proj.join("real.wav");
        fs::write(&target, b"wav").unwrap();
        let link = proj.join("link.wav");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        let resolved = resolve_audio_path(&st, "projects/p1/link.wav").unwrap();
        assert_eq!(resolved, fs::canonicalize(&target).unwrap());
        let _ = fs::remove_dir_all(tmp);
    }

    #[cfg(unix)]
    #[test]
    fn symlink_outside_media_base_rejected() {
        let (tmp, st) = temp_state();
        let media = tmp.join("media");
        fs::create_dir_all(media.join("projects").join("p1")).unwrap();
        write_media_base_pref(&st, media.to_str().unwrap()).unwrap();
        let outside = std::env::temp_dir().join(format!("rushi-symlink-out-{}", Uuid::new_v4()));
        fs::write(&outside, b"x").unwrap();
        let link = media.join("projects").join("p1").join("escape.wav");
        std::os::unix::fs::symlink(&outside, &link).unwrap();
        let err = resolve_audio_path(&st, "projects/p1/escape.wav").unwrap_err();
        assert!(err.contains("符号链接") || err.contains("媒体基准") || err.contains("应用数据根"));
        let _ = fs::remove_file(outside);
        let _ = fs::remove_dir_all(tmp);
    }

    #[cfg(windows)]
    #[test]
    fn symlink_inside_media_base_resolves_windows() {
        let (tmp, st) = temp_state();
        let media = tmp.join("media");
        let proj = media.join("projects").join("p1");
        fs::create_dir_all(&proj).unwrap();
        write_media_base_pref(&st, media.to_str().unwrap()).unwrap();
        let target = proj.join("real.wav");
        fs::write(&target, b"wav").unwrap();
        let link = proj.join("link.wav");
        if std::os::windows::fs::symlink_file(&target, &link).is_err() {
            // Symlink privilege not available (non-admin / Developer Mode off).
            let _ = fs::remove_dir_all(tmp);
            return;
        }
        let resolved = resolve_audio_path(&st, "projects/p1/link.wav").unwrap();
        assert_eq!(resolved, fs::canonicalize(&target).unwrap());
        let _ = fs::remove_dir_all(tmp);
    }
}

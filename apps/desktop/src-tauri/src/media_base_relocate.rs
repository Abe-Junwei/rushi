//! Library-level media base relocate (audio + peaks). Pref switches only after full success.

use crate::media_base_dir::{
    audio_project_dir, path_to_user_string, persist_audio_storage_path, read_media_base_pref_raw,
    resolve_media_base, strip_windows_verbatim_prefix, write_media_base_pref,
    write_relocate_allow_root, MediaBaseDirInfo,
};
use crate::native_audio::NativeAudioState;
use crate::project::utils::{append_desktop_log_line, open_db};
use crate::project::waveform_peaks::{peak_file_path, peak_meta_path, peaks_dir, PEAK_LEVELS};
use crate::DbState;
use rusqlite::params;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

fn prepare_for_relocate(app: &AppHandle) -> Result<(), String> {
    if crate::asr_sidecar::warm::transcribe_in_flight() {
        return Err("正在转写，请结束后再搬迁媒体库。".into());
    }
    // Native decode keeps the media file open even when paused. A full `stop()` joins
    // the engine thread and can hang forever on Windows (CPAL stream teardown) — the
    // relocate IPC then never returns, so the confirm dialog stays open with no folder
    // change. Detach join; brief settle lets decode close the file before rename.
    if let Some(audio) = app.try_state::<NativeAudioState>() {
        audio.stop_detached_for_relocate();
    }
    Ok(())
}

fn is_sharing_violation(err: &std::io::Error) -> bool {
    err.raw_os_error() == Some(32)
        || err.raw_os_error() == Some(33)
        || err
            .to_string()
            .to_ascii_lowercase()
            .contains("being used by another process")
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaBaseManagedSummary {
    pub file_count: u64,
    pub project_count: u64,
    pub needs_relocate: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaBasePickPreview {
    pub path: String,
    pub summary: MediaBaseManagedSummary,
}

fn map_move_io_error(context: &str, err: std::io::Error) -> String {
    let raw = err.to_string();
    if is_sharing_violation(&err) {
        format!("{context}：文件被占用。请关闭当前打开的项目音频后重试（{raw}）")
    } else {
        format!("{context}: {raw}")
    }
}

fn move_path(from: &Path, to: &Path) -> Result<(), String> {
    // Windows: AV / WebView / decoder may hold handles briefly after stop.
    const ATTEMPTS: u32 = 4;
    let mut last_err: Option<std::io::Error> = None;
    for attempt in 0..ATTEMPTS {
        match move_path_once(from, to) {
            Ok(()) => return Ok(()),
            Err(e) if is_sharing_violation(&e) && attempt + 1 < ATTEMPTS => {
                last_err = Some(e);
                std::thread::sleep(Duration::from_millis(120 * u64::from(attempt + 1)));
            }
            Err(e) => return Err(map_move_io_error("搬迁失败", e)),
        }
    }
    Err(map_move_io_error(
        "搬迁失败",
        last_err.unwrap_or_else(|| std::io::Error::other("unknown sharing violation")),
    ))
}

fn move_path_once(from: &Path, to: &Path) -> Result<(), std::io::Error> {
    if !from.exists() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent)?;
    }
    if to.exists() {
        if to.is_file() {
            fs::remove_file(to)?;
        } else if to.is_dir() {
            // Merge: move children when dest dir already exists.
            if from.is_dir() {
                for entry in fs::read_dir(from)? {
                    let entry = entry?;
                    let name = entry.file_name();
                    move_path_once(&entry.path(), &to.join(name))?;
                }
                let _ = fs::remove_dir(from);
                return Ok(());
            }
            fs::remove_dir_all(to)?;
        }
    }
    match fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(rename_err) => {
            if from.is_file() {
                fs::copy(from, to).and_then(|_| fs::remove_file(from))
            } else if is_sharing_violation(&rename_err) {
                Err(rename_err)
            } else {
                copy_dir_recursive_io(from, to)?;
                fs::remove_dir_all(from)
            }
        }
    }
}

fn copy_dir_recursive_io(from: &Path, to: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let dest = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive_io(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), &dest)?;
        }
    }
    Ok(())
}

pub(crate) fn list_audio_rows(st: &DbState) -> Result<Vec<(String, String, String)>, String> {
    let conn = open_db(st)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, audio_path FROM files \
             WHERE audio_path IS NOT NULL AND TRIM(audio_path) != ''",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// True when library has audio rows or on-disk project media under current / legacy roots.
pub fn managed_media_summary(st: &DbState) -> Result<MediaBaseManagedSummary, String> {
    let rows = list_audio_rows(st)?;
    let mut projects = std::collections::HashSet::new();
    for (_, pid, _) in &rows {
        projects.insert(pid.clone());
    }
    let file_count = rows.len() as u64;
    let project_count = projects.len() as u64;
    Ok(MediaBaseManagedSummary {
        needs_relocate: file_count > 0 || project_count > 0,
        file_count,
        project_count,
    })
}

/// Peaks are rebuildable; WebView / PeakCache often keeps `.dat` open on Windows.
/// Never fail the whole library relocate because a peak file is locked.
fn move_peaks_for_file_best_effort(src_peaks: &Path, dest_peaks: &Path, file_id: &str) {
    if !src_peaks.is_dir() {
        return;
    }
    if fs::create_dir_all(dest_peaks).is_err() {
        return;
    }
    for (level, _) in PEAK_LEVELS {
        let from = peak_file_path(src_peaks, file_id, level);
        if from.is_file() {
            let to = peak_file_path(dest_peaks, file_id, level);
            let _ = move_path(&from, &to);
        }
    }
    let meta_from = peak_meta_path(src_peaks, file_id);
    if meta_from.is_file() {
        let _ = move_path(&meta_from, &peak_meta_path(dest_peaks, file_id));
    }
}

pub(crate) fn paths_same_file(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(ca), Ok(cb)) => ca == cb,
        _ => false,
    }
}

/// Absolute path for DB while relocate is in progress (pref still points at source).
/// Relative paths would join the old media base and break mid-move / on failure.
pub(crate) fn store_absolute_under_dest(dest_audio: &Path) -> Result<String, String> {
    let can = fs::canonicalize(dest_audio)
        .map_err(|e| format!("无法规范化搬迁后音频路径: {e}"))?;
    Ok(path_to_user_string(&can))
}

/// Resolve a managed file for relocate/relink purposes; also used by `media_base_relink`
/// when the source base itself is unreachable (falls through to the dest-side check below).
pub(crate) fn resolve_for_relocate(
    st: &DbState,
    file_id: &str,
    audio_path: &str,
    dest_proj: &Path,
) -> Result<PathBuf, String> {
    let normalized = strip_windows_verbatim_prefix(audio_path);
    match crate::media_base_dir::resolve_audio_path(st, &normalized) {
        Ok(p) => Ok(p),
        Err(e) => {
            // Partial retry: file may already sit at destination from a prior failed run.
            let leaf = Path::new(&normalized)
                .file_name()
                .ok_or_else(|| format!("无法解析音频（{file_id}）：{e}"))?;
            let dest_audio = dest_proj.join(leaf);
            if dest_audio.is_file() {
                fs::canonicalize(&dest_audio).map_err(|err| {
                    format!("无法规范化已在目标的音频（{file_id}）：{err}")
                })
            } else {
                Err(format!("无法解析音频（{file_id}）：{e}"))
            }
        }
    }
}

/// Relocate all managed media from current media base (+ legacy app_data peaks) to `dest_base`.
/// Writes **absolute** `audio_path` under dest while pref is still the source; caller switches
/// pref then relativizes. Clears allow root only after full commit success.
fn relocate_all_to(st: &DbState, dest_base: &Path) -> Result<(), String> {
    let src_base = resolve_media_base(st)?;
    let dest_can = fs::canonicalize(dest_base).map_err(|e| format!("无法解析目标目录: {e}"))?;
    let src_can = fs::canonicalize(&src_base).map_err(|e| format!("无法解析源媒体基准: {e}"))?;
    if dest_can == src_can {
        return Ok(());
    }

    write_relocate_allow_root(st, Some(&dest_can))?;

    let rows = list_audio_rows(st)?;
    let conn = open_db(st)?;
    let mut failures: Vec<String> = Vec::new();

    for (file_id, project_id, audio_path) in rows {
        let dest_proj = audio_project_dir(&dest_can, &project_id);
        let dest_peaks = peaks_dir(&dest_proj);

        // Peaks: prefer media-base project dir, else legacy app_data project dir.
        let src_media_peaks = peaks_dir(&audio_project_dir(&src_can, &project_id));
        let src_legacy_peaks = peaks_dir(&st.root.join("projects").join(&project_id));
        if let Err(e) = (|| -> Result<(), String> {
            if src_media_peaks != dest_peaks {
                move_peaks_for_file_best_effort(&src_media_peaks, &dest_peaks, &file_id);
            }
            if src_legacy_peaks != dest_peaks && src_legacy_peaks != src_media_peaks {
                move_peaks_for_file_best_effort(&src_legacy_peaks, &dest_peaks, &file_id);
            }

            let resolved = resolve_for_relocate(st, &file_id, &audio_path, &dest_proj)?;
            let file_name = resolved
                .file_name()
                .ok_or_else(|| "音频路径无效".to_string())?;
            let dest_audio = dest_proj.join(file_name);
            if !paths_same_file(&resolved, &dest_audio) {
                move_path(&resolved, &dest_audio)?;
            }
            // Absolute while pref still points at source (relocate-allow scopes reads).
            let stored = store_absolute_under_dest(&dest_audio)?;
            conn.execute(
                "UPDATE files SET audio_path = ?1, updated_at_ms = ?2 WHERE id = ?3",
                params![
                    stored,
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0),
                    file_id
                ],
            )
            .map_err(|e| format!("回写 audio_path 失败: {e}"))?;
            Ok(())
        })() {
            append_desktop_log_line(
                st,
                &format!("WARN media_base_relocate file={file_id}: {e}"),
            );
            failures.push(e);
        }
    }

    if !failures.is_empty() {
        return Err(failures.join("；"));
    }

    // Best-effort: move leftover project dirs (empty peaks folders etc.)
    let src_projects = src_can.join("projects");
    if src_projects.is_dir() {
        for entry in fs::read_dir(&src_projects).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let name = entry.file_name();
            let dest = dest_can.join("projects").join(&name);
            if entry.path() != dest {
                let _ = move_path(&entry.path(), &dest);
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_media_base_managed_summary(
    state: State<'_, DbState>,
) -> Result<MediaBaseManagedSummary, String> {
    managed_media_summary(state.inner())
}

#[tauri::command]
pub fn pick_media_base_dir_preview(
    state: State<'_, DbState>,
) -> Result<Option<MediaBasePickPreview>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择媒体存放目录")
        .pick_folder();
    let Some(dir) = picked else {
        return Ok(None);
    };
    let path = path_to_user_string(&dir);
    let summary = managed_media_summary(state.inner())?;
    Ok(Some(MediaBasePickPreview { path, summary }))
}

/// Commit media base change. When `relocate` is true (or summary needs it), moves media then sets pref.
/// `path = None` restores default (app data root).
pub fn commit_media_base_dir_change_inner(
    path: Option<String>,
    relocate: bool,
    app: &AppHandle,
    st: &DbState,
) -> Result<MediaBaseDirInfo, String> {
    let summary = managed_media_summary(st)?;
    if summary.needs_relocate && !relocate {
        return Err("库中已有媒体文件，必须搬迁到新位置，不能仅改路径。".into());
    }
    if summary.needs_relocate {
        prepare_for_relocate(app)?;
    }
    let info = apply_media_base_dir_change(path, summary.needs_relocate, st)?;
    crate::project::asset_scope::allow_media_base_directory(app, Path::new(&info.media_base_dir));
    Ok(info)
}

/// Core relocate/relink + pref switch. Independent of `AppHandle` (the caller already handled
/// the app-level steps: ASR-in-flight guard, audio stop, asset-scope allow) so it's directly
/// unit-testable without a mock Tauri app. `pub(crate)` so `media_base_relink` tests can drive
/// the full commit flow (relocate vs relink branch) without an `AppHandle`.
pub(crate) fn apply_media_base_dir_change(
    path: Option<String>,
    needs_relocate: bool,
    st: &DbState,
) -> Result<MediaBaseDirInfo, String> {
    // Always canonicalize (including restore-default → app_data) so persist/strip_prefix match.
    let dest_raw: PathBuf = match path
        .as_deref()
        .map(strip_windows_verbatim_prefix)
        .filter(|s| !s.is_empty())
    {
        None => st.root.clone(),
        Some(p) => {
            let pb = PathBuf::from(&p);
            if !pb.is_dir() {
                return Err("媒体基准目录不存在或不是文件夹。".into());
            }
            pb
        }
    };
    let dest = fs::canonicalize(&dest_raw).map_err(|e| format!("无法解析媒体基准目录：{e}"))?;

    if needs_relocate {
        match resolve_media_base(st) {
            Ok(_) => {
                relocate_all_to(st, &dest).map_err(|e| {
                    append_desktop_log_line(st, &format!("WARN media_base_relocate failed: {e}"));
                    // Keep allow root so partially moved absolute/relative files under dest still resolve.
                    format!("搬迁未完成（媒体基准未切换）：{e}")
                })?;
            }
            Err(e) => {
                // Old base itself is gone — there's nothing to move. Best-effort relink
                // files already at dest, then still switch the pref below so "恢复默认" /
                // "选择…" never dead-end just because the previous directory disappeared.
                append_desktop_log_line(
                    st,
                    &format!("WARN media_base source unavailable, relinking best-effort: {e}"),
                );
                crate::media_base_relink::relink_from_missing_source(st, &dest);
            }
        }
    }

    let restore_default = path
        .as_deref()
        .map(strip_windows_verbatim_prefix)
        .unwrap_or_default()
        .is_empty();
    let pref_value = if restore_default {
        String::new()
    } else {
        path_to_user_string(&dest)
    };
    write_media_base_pref(st, &pref_value)?;
    write_relocate_allow_root(st, None)?;

    // Relativize any absolute paths now under the new base (incl. legacy `\\?\` abs paths).
    if let Ok(rows) = list_audio_rows(st) {
        if let Ok(conn) = open_db(st) {
            for (file_id, _, audio_path) in rows {
                let normalized = strip_windows_verbatim_prefix(&audio_path);
                if let Ok(resolved) = crate::media_base_dir::resolve_audio_path(st, &normalized) {
                    if let Ok(stored) = persist_audio_storage_path(&dest, &resolved) {
                        let _ = conn.execute(
                            "UPDATE files SET audio_path = ?1 WHERE id = ?2",
                            params![stored, file_id],
                        );
                    }
                }
            }
        }
    }

    Ok(MediaBaseDirInfo {
        media_base_dir: path_to_user_string(&resolve_media_base(st)?),
        is_custom: !read_media_base_pref_raw(st).is_empty(),
        app_data_root: path_to_user_string(&st.root),
        unavailable: false,
    })
}

/// Async wrapper: keep WebView responsive (busy label / cancel) while files move on Windows.
#[tauri::command]
pub async fn commit_media_base_dir_change(
    path: Option<String>,
    relocate: bool,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<MediaBaseDirInfo, String> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        commit_media_base_dir_change_inner(path, relocate, &app, &st)
    })
    .await
    .map_err(|e| format!("搬迁任务失败: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_base_dir::{persist_audio_storage_path, write_media_base_pref};
    use uuid::Uuid;

    fn temp_state() -> (PathBuf, DbState) {
        let tmp = std::env::temp_dir().join(format!("rushi-relocate-{}", Uuid::new_v4()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let st = DbState::open_test_db_at(tmp.clone(), tmp.join("app.db"));
        (tmp, st)
    }

    #[test]
    fn empty_library_needs_no_relocate() {
        let (tmp, st) = temp_state();
        let s = managed_media_summary(&st).unwrap();
        assert!(!s.needs_relocate);
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn relocate_moves_audio_and_peaks_then_switches_pref() {
        let (tmp, st) = temp_state();
        let media_a = tmp.join("a");
        let media_b = tmp.join("b");
        fs::create_dir_all(&media_a).unwrap();
        fs::create_dir_all(&media_b).unwrap();
        write_media_base_pref(&st, media_a.to_str().unwrap()).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let proj = audio_project_dir(&media_a, &project_id);
        fs::create_dir_all(peaks_dir(&proj)).unwrap();
        let audio = proj.join(format!("{file_id}.wav"));
        fs::write(&audio, b"wav").unwrap();
        fs::write(peak_file_path(&peaks_dir(&proj), &file_id, 0), b"p0").unwrap();
        let stored = persist_audio_storage_path(&media_a, &audio).unwrap();

        let conn = open_db(&st).unwrap();
        let t = 1_i64;
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, 'p', ?2, ?2)",
            params![project_id, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 'n', 'audio_only', ?3, ?4, ?4)",
            params![file_id, project_id, stored, t],
        )
        .unwrap();
        drop(conn);

        relocate_all_to(&st, &media_b).unwrap();
        // Mid-relocate: pref still at A; DB should hold absolute under B and still resolve.
        let conn = open_db(&st).unwrap();
        let mid_path: String = conn
            .query_row(
                "SELECT audio_path FROM files WHERE id = ?1",
                params![file_id],
                |r| r.get(0),
            )
            .unwrap();
        drop(conn);
        assert!(
            crate::media_base_dir::path_is_absolute_storage(&mid_path)
                || Path::new(&mid_path).is_absolute(),
            "mid-relocate path should be absolute: {mid_path}"
        );
        let mid_resolved = crate::media_base_dir::resolve_audio_path(&st, &mid_path).unwrap();
        let dest_audio = audio_project_dir(&media_b, &project_id).join(format!("{file_id}.wav"));
        assert_eq!(mid_resolved, fs::canonicalize(&dest_audio).unwrap());

        write_media_base_pref(&st, media_b.to_str().unwrap()).unwrap();
        write_relocate_allow_root(&st, None).unwrap();

        assert!(dest_audio.is_file());
        assert!(peak_file_path(
            &peaks_dir(&audio_project_dir(&media_b, &project_id)),
            &file_id,
            0
        )
        .is_file());
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn mid_relocate_absolute_resolves_while_pref_still_source() {
        let (tmp, st) = temp_state();
        let media_a = tmp.join("a");
        let media_b = tmp.join("b");
        fs::create_dir_all(&media_a).unwrap();
        fs::create_dir_all(&media_b).unwrap();
        write_media_base_pref(&st, media_a.to_str().unwrap()).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let dest_audio = audio_project_dir(&media_b, &project_id).join(format!("{file_id}.wav"));
        fs::create_dir_all(dest_audio.parent().unwrap()).unwrap();
        fs::write(&dest_audio, b"wav").unwrap();
        write_relocate_allow_root(&st, Some(&media_b)).unwrap();

        let abs = path_to_user_string(&fs::canonicalize(&dest_audio).unwrap());
        let resolved = crate::media_base_dir::resolve_audio_path(&st, &abs).unwrap();
        assert_eq!(resolved, fs::canonicalize(&dest_audio).unwrap());

        // Relative under dest also joins relocate-allow while allow is set.
        let rel = format!("projects/{project_id}/{file_id}.wav");
        let resolved_rel = crate::media_base_dir::resolve_audio_path(&st, &rel).unwrap();
        assert_eq!(resolved_rel, fs::canonicalize(&dest_audio).unwrap());

        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn relocate_fails_when_audio_unresolvable() {
        let (tmp, st) = temp_state();
        let media_a = tmp.join("a");
        let media_b = tmp.join("b");
        fs::create_dir_all(&media_a).unwrap();
        fs::create_dir_all(&media_b).unwrap();
        write_media_base_pref(&st, media_a.to_str().unwrap()).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let conn = open_db(&st).unwrap();
        let t = 1_i64;
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, 'p', ?2, ?2)",
            params![project_id, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 'n', 'audio_only', ?3, ?4, ?4)",
            params![file_id, project_id, "projects/missing/nope.wav", t],
        )
        .unwrap();
        drop(conn);

        let err = relocate_all_to(&st, &media_b).unwrap_err();
        assert!(err.contains(&file_id) || err.contains("无法解析"));
        let _ = fs::remove_dir_all(tmp);
    }

    fn simulate_full_relocate_commit(st: &DbState, dest: &Path) {
        relocate_all_to(st, dest).unwrap();
        write_media_base_pref(st, &path_to_user_string(dest)).unwrap();
        write_relocate_allow_root(st, None).unwrap();
        let dest_can = fs::canonicalize(dest).unwrap();
        let rows = list_audio_rows(st).unwrap();
        let conn = open_db(st).unwrap();
        for (file_id, _, audio_path) in rows {
            let resolved = crate::media_base_dir::resolve_audio_path(st, &audio_path).unwrap();
            let stored = persist_audio_storage_path(&dest_can, &resolved).unwrap();
            conn.execute(
                "UPDATE files SET audio_path = ?1 WHERE id = ?2",
                params![stored, file_id],
            )
            .unwrap();
        }
    }

    #[test]
    fn relocate_mixed_legacy_absolute_and_relative_under_verbatim_pref() {
        let (tmp, st) = temp_state();
        let media_a = tmp.join("a");
        let media_b = tmp.join("b");
        fs::create_dir_all(&media_a).unwrap();
        fs::create_dir_all(&media_b).unwrap();
        // Simulate legacy pref that still stores `\\?\` (healed on read).
        let pref_raw = format!(
            "{}{}",
            if cfg!(windows) { r"\\?\" } else { "" },
            media_a.display()
        );
        fs::create_dir_all(st.root.join("prefs")).unwrap();
        fs::write(st.root.join("prefs/media_base_dir.txt"), format!("{pref_raw}\n")).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_rel = Uuid::new_v4().to_string();
        let file_abs = Uuid::new_v4().to_string();

        let proj_a = audio_project_dir(&media_a, &project_id);
        fs::create_dir_all(peaks_dir(&proj_a)).unwrap();
        let audio_rel = proj_a.join(format!("{file_rel}.wav"));
        fs::write(&audio_rel, b"rel").unwrap();
        fs::write(peak_file_path(&peaks_dir(&proj_a), &file_rel, 0), b"p").unwrap();
        let stored_rel = persist_audio_storage_path(&media_a, &audio_rel).unwrap();

        let legacy_dir = st.root.join("projects").join(&project_id);
        fs::create_dir_all(peaks_dir(&legacy_dir)).unwrap();
        let audio_abs = legacy_dir.join(format!("{file_abs}.mp3"));
        fs::write(&audio_abs, b"abs").unwrap();
        fs::write(peak_file_path(&peaks_dir(&legacy_dir), &file_abs, 0), b"p").unwrap();
        // Legacy DB rows often store canonicalize()'s verbatim `\\?\` form.
        let stored_abs = fs::canonicalize(&audio_abs)
            .unwrap()
            .to_string_lossy()
            .into_owned();

        let conn = open_db(&st).unwrap();
        let t = 1_i64;
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, 'p', ?2, ?2)",
            params![project_id, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 'rel', 'audio_only', ?3, ?4, ?4)",
            params![file_rel, project_id, stored_rel, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 'abs', 'audio_only', ?3, ?4, ?4)",
            params![file_abs, project_id, stored_abs, t],
        )
        .unwrap();
        drop(conn);

        simulate_full_relocate_commit(&st, &media_b);
        assert!(audio_project_dir(&media_b, &project_id)
            .join(format!("{file_rel}.wav"))
            .is_file());
        assert!(audio_project_dir(&media_b, &project_id)
            .join(format!("{file_abs}.mp3"))
            .is_file());

        // Restore toward app_data root (default).
        simulate_full_relocate_commit(&st, &st.root.clone());
        assert!(st
            .root
            .join("projects")
            .join(&project_id)
            .join(format!("{file_rel}.wav"))
            .is_file());
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn relocate_twice_a_to_b_to_c() {
        let (tmp, st) = temp_state();
        let media_a = tmp.join("a");
        let media_b = tmp.join("b");
        let media_c = tmp.join("c");
        fs::create_dir_all(&media_a).unwrap();
        fs::create_dir_all(&media_b).unwrap();
        fs::create_dir_all(&media_c).unwrap();
        write_media_base_pref(&st, media_a.to_str().unwrap()).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let proj = audio_project_dir(&media_a, &project_id);
        fs::create_dir_all(peaks_dir(&proj)).unwrap();
        let audio = proj.join(format!("{file_id}.wav"));
        fs::write(&audio, b"wav").unwrap();
        let stored = persist_audio_storage_path(&media_a, &audio).unwrap();
        let conn = open_db(&st).unwrap();
        let t = 1_i64;
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, 'p', ?2, ?2)",
            params![project_id, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 'n', 'audio_only', ?3, ?4, ?4)",
            params![file_id, project_id, stored, t],
        )
        .unwrap();
        drop(conn);

        simulate_full_relocate_commit(&st, &media_b);
        let path_b: String = open_db(&st)
            .unwrap()
            .query_row(
                "SELECT audio_path FROM files WHERE id = ?1",
                params![file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert!(
            !crate::media_base_dir::path_is_absolute_storage(&path_b),
            "after B should be relative: {path_b}"
        );
        assert!(audio_project_dir(&media_b, &project_id)
            .join(format!("{file_id}.wav"))
            .is_file());

        simulate_full_relocate_commit(&st, &media_c);
        assert!(audio_project_dir(&media_c, &project_id)
            .join(format!("{file_id}.wav"))
            .is_file());
        let path_c: String = open_db(&st)
            .unwrap()
            .query_row(
                "SELECT audio_path FROM files WHERE id = ?1",
                params![file_id],
                |r| r.get(0),
            )
            .unwrap();
        let resolved = crate::media_base_dir::resolve_audio_path(&st, &path_c).unwrap();
        assert_eq!(
            resolved,
            fs::canonicalize(
                audio_project_dir(&media_c, &project_id).join(format!("{file_id}.wav"))
            )
            .unwrap()
        );
        let _ = fs::remove_dir_all(tmp);
    }
}

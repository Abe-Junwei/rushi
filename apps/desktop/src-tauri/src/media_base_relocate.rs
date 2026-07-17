//! Library-level media base relocate (audio + peaks). Pref switches only after full success.

use crate::media_base_dir::{
    audio_project_dir, path_to_user_string, persist_audio_storage_path, read_media_base_pref_raw,
    resolve_media_base, write_media_base_pref, write_relocate_allow_root, MediaBaseDirInfo,
};
use crate::native_audio::NativeAudioState;
use crate::project::utils::open_db;
use crate::project::waveform_peaks::{peak_file_path, peak_meta_path, peaks_dir, PEAK_LEVELS};
use crate::DbState;
use rusqlite::params;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

fn assert_idle_for_relocate(app: &AppHandle) -> Result<(), String> {
    if crate::asr_sidecar::warm::transcribe_in_flight() {
        return Err("正在转写，请结束后再搬迁媒体库。".into());
    }
    if let Some(audio) = app.try_state::<NativeAudioState>() {
        if let Ok(snap) = audio.with_player(|p| Ok(p.snapshot())) {
            if snap.playing {
                return Err("正在播放，请暂停后再搬迁媒体库。".into());
            }
        }
    }
    Ok(())
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

fn move_path(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    if to.exists() {
        if to.is_file() {
            fs::remove_file(to).map_err(|e| format!("覆盖目标失败: {e}"))?;
        } else if to.is_dir() {
            // Merge: move children when dest dir already exists.
            if from.is_dir() {
                for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
                    let entry = entry.map_err(|e| e.to_string())?;
                    let name = entry.file_name();
                    move_path(&entry.path(), &to.join(name))?;
                }
                let _ = fs::remove_dir(from);
                return Ok(());
            }
            fs::remove_dir_all(to).map_err(|e| format!("覆盖目标目录失败: {e}"))?;
        }
    }
    fs::rename(from, to).or_else(|_| {
        if from.is_file() {
            fs::copy(from, to)
                .map(|_| ())
                .and_then(|_| fs::remove_file(from))
                .map_err(|e| format!("跨卷复制失败: {e}"))
        } else {
            copy_dir_recursive(from, to)?;
            fs::remove_dir_all(from).map_err(|e| format!("删除源目录失败: {e}"))
        }
    })
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let dest = to.join(entry.file_name());
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            copy_dir_recursive(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn list_audio_rows(st: &DbState) -> Result<Vec<(String, String, String)>, String> {
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

fn move_peaks_for_file(src_peaks: &Path, dest_peaks: &Path, file_id: &str) -> Result<(), String> {
    if !src_peaks.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(dest_peaks).map_err(|e| e.to_string())?;
    for (level, _) in PEAK_LEVELS {
        let from = peak_file_path(src_peaks, file_id, level);
        if from.is_file() {
            let to = peak_file_path(dest_peaks, file_id, level);
            move_path(&from, &to)?;
        }
    }
    let meta_from = peak_meta_path(src_peaks, file_id);
    if meta_from.is_file() {
        move_path(&meta_from, &peak_meta_path(dest_peaks, file_id))?;
    }
    Ok(())
}

/// Absolute path for DB while relocate is in progress (pref still points at source).
/// Relative paths would join the old media base and break mid-move / on failure.
fn store_absolute_under_dest(dest_audio: &Path) -> Result<String, String> {
    let can = fs::canonicalize(dest_audio)
        .map_err(|e| format!("无法规范化搬迁后音频路径: {e}"))?;
    Ok(path_to_user_string(&can))
}

fn resolve_for_relocate(
    st: &DbState,
    file_id: &str,
    audio_path: &str,
    dest_proj: &Path,
) -> Result<PathBuf, String> {
    match crate::media_base_dir::resolve_audio_path(st, audio_path) {
        Ok(p) => Ok(p),
        Err(e) => {
            // Partial retry: file may already sit at destination from a prior failed run.
            let leaf = Path::new(audio_path)
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
                move_peaks_for_file(&src_media_peaks, &dest_peaks, &file_id)?;
            }
            if src_legacy_peaks != dest_peaks && src_legacy_peaks != src_media_peaks {
                move_peaks_for_file(&src_legacy_peaks, &dest_peaks, &file_id)?;
            }

            let resolved = resolve_for_relocate(st, &file_id, &audio_path, &dest_proj)?;
            let file_name = resolved
                .file_name()
                .ok_or_else(|| "音频路径无效".to_string())?;
            let dest_audio = dest_proj.join(file_name);
            if resolved != dest_audio {
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
#[tauri::command]
pub fn commit_media_base_dir_change(
    path: Option<String>,
    relocate: bool,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<MediaBaseDirInfo, String> {
    let st = state.inner();
    let summary = managed_media_summary(st)?;
    if summary.needs_relocate && !relocate {
        return Err("库中已有媒体文件，必须搬迁到新位置，不能仅改路径。".into());
    }
    if summary.needs_relocate {
        assert_idle_for_relocate(&app)?;
    }

    let dest: PathBuf = match path.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => st.root.clone(),
        Some(p) => {
            let pb = PathBuf::from(p);
            if !pb.is_dir() {
                return Err("媒体基准目录不存在或不是文件夹。".into());
            }
            fs::canonicalize(&pb).map_err(|e| format!("无法解析媒体基准目录：{e}"))?
        }
    };

    if summary.needs_relocate {
        relocate_all_to(st, &dest).map_err(|e| {
            // Keep allow root so partially moved absolute/relative files under dest still resolve.
            format!("搬迁未完成（媒体基准未切换）：{e}")
        })?;
    }

    let pref_value = if path.as_deref().map(str::trim).unwrap_or("").is_empty() {
        String::new()
    } else {
        path_to_user_string(&dest)
    };
    write_media_base_pref(st, &pref_value)?;
    write_relocate_allow_root(st, None)?;

    // Relativize any absolute paths now under the new base.
    if let Ok(rows) = list_audio_rows(st) {
        if let Ok(conn) = open_db(st) {
            for (file_id, _, audio_path) in rows {
                if let Ok(resolved) = crate::media_base_dir::resolve_audio_path(st, &audio_path) {
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

    let info = MediaBaseDirInfo {
        media_base_dir: path_to_user_string(&resolve_media_base(st)?),
        is_custom: !read_media_base_pref_raw(st).is_empty(),
        app_data_root: path_to_user_string(&st.root),
    };
    crate::project::asset_scope::allow_media_base_directory(&app, Path::new(&info.media_base_dir));
    Ok(info)
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
}

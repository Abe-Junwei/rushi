use super::utils::remove_audio_file;
use super::waveform_peaks_cmd::cleanup_peaks_for_file;
use crate::DbState;
use std::fs;
use std::path::{Path, PathBuf};

pub fn project_storage_dir(app_root: &Path, project_id: &str) -> PathBuf {
    app_root.join("projects").join(project_id)
}

pub fn projects_storage_root(app_root: &Path) -> PathBuf {
    app_root.join("projects")
}

/// Remove copied audio + waveform peaks for a deleted file row.
pub fn cleanup_deleted_file_storage(
    st: &DbState,
    project_id: &str,
    file_id: &str,
    audio_path: Option<&str>,
) {
    cleanup_peaks_for_file(st, project_id, file_id);
    if let Some(path) = audio_path.filter(|value| !value.is_empty()) {
        let _ = remove_audio_file(&st.root, path);
    }
}

/// Best-effort removal of the on-disk project bundle after the DB row is already
/// committed. A filesystem failure is logged (WARN) but never propagated, so it can
/// only leave sweepable orphan files — never a reverse orphan (DB row whose media
/// was already deleted).
pub fn cleanup_deleted_project_storage(st: &DbState, project_id: &str) {
    if let Err(err) = remove_project_storage_dir(&st.root, project_id) {
        super::utils::append_desktop_log_line(
            st,
            &format!("WARN project_storage_cleanup project_id={project_id} {err}"),
        );
    }
}

pub fn remove_project_storage_dir(app_root: &Path, project_id: &str) -> Result<(), String> {
    let project_dir = project_storage_dir(app_root, project_id);
    if !project_dir.exists() {
        return Ok(());
    }
    let sm =
        fs::symlink_metadata(&project_dir).map_err(|e| format!("无法读取项目目录元数据: {e}"))?;
    if sm.file_type().is_symlink() {
        return Err("拒绝删除：项目目录为符号链接，请先移除链接。".into());
    }
    let root_can =
        fs::canonicalize(app_root).map_err(|e| format!("无法解析应用数据根目录: {e}"))?;
    let project_can =
        fs::canonicalize(&project_dir).map_err(|e| format!("无法解析项目目录: {e}"))?;
    let projects_root = root_can.join("projects");
    if project_can == root_can || project_can == projects_root {
        return Err("拒绝删除：项目目录路径无效。".into());
    }
    if project_can.strip_prefix(&root_can).is_err() {
        return Err("拒绝删除：项目目录不在应用数据根之下。".into());
    }
    if project_can.strip_prefix(&projects_root).is_err() {
        return Err("拒绝删除：项目目录不在 projects/ 之下。".into());
    }
    fs::remove_dir_all(&project_can).map_err(|e| format!("删除项目目录失败: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    fn test_state(label: &str) -> DbState {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi-project-storage-{label}-{unique}"));
        fs::create_dir_all(&root).unwrap();
        DbState::open_test_db(root)
    }

    #[test]
    fn cleanup_deleted_file_storage_removes_audio_and_peaks() {
        let st = test_state("file");
        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let project_dir = project_storage_dir(&st.root, &project_id);
        fs::create_dir_all(project_dir.join("peaks")).unwrap();
        let audio = project_dir.join(format!("{file_id}.wav"));
        fs::write(&audio, b"audio").unwrap();
        fs::write(
            project_dir.join("peaks").join(format!("{file_id}_L0.dat")),
            b"peaks",
        )
        .unwrap();

        cleanup_deleted_file_storage(&st, &project_id, &file_id, Some(&audio.to_string_lossy()));

        assert!(!audio.is_file());
        assert!(!project_dir
            .join("peaks")
            .join(format!("{file_id}_L0.dat"))
            .is_file());
        let _ = fs::remove_dir_all(&st.root);
    }

    #[test]
    fn remove_project_storage_dir_removes_peaks_without_audio() {
        let st = test_state("project");
        let project_id = Uuid::new_v4().to_string();
        let project_dir = project_storage_dir(&st.root, &project_id);
        fs::create_dir_all(project_dir.join("peaks")).unwrap();
        fs::write(project_dir.join("peaks").join("orphan_L0.dat"), b"x").unwrap();

        remove_project_storage_dir(&st.root, &project_id).unwrap();

        assert!(!project_dir.exists());
        let _ = fs::remove_dir_all(&st.root);
    }
}

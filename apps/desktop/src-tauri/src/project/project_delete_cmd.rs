use super::project_storage::cleanup_deleted_project_storage;
use super::utils::open_db;
use crate::command_error::{CommandError, CommandErrorDto, CommandResult, CommandResultExt};
use crate::DbState;
use rusqlite::params;
use tauri::State;

pub(crate) fn project_delete_inner(st: &DbState, project_id: &str) -> CommandResult<()> {
    let mut conn = open_db(st).map_err(CommandError::db_pool)?;
    let tx = conn.transaction().map_err(CommandError::from)?;

    let deleted = tx
        .execute("DELETE FROM projects WHERE id = ?1", params![project_id])
        .map_err(CommandError::from)?;
    if deleted == 0 {
        return Err(CommandError::ProjectNotFound);
    }
    tx.commit().map_err(CommandError::from)?;

    // DB is the source of truth: commit the row deletion first, then remove the
    // on-disk bundle best-effort. A filesystem failure here leaves only sweepable
    // orphan files, never a DB row pointing at already-deleted media.
    cleanup_deleted_project_storage(st, project_id);
    Ok(())
}

#[tauri::command]
pub async fn project_delete(
    state: State<'_, DbState>,
    project_id: String,
) -> Result<(), CommandErrorDto> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || project_delete_inner(&st, &project_id))
        .await
        .map_err(|e| {
            CommandError::DeleteProject {
                detail: e.to_string(),
            }
            .to_dto()
        })?
        .map_command_err_dto()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::project_storage::project_storage_dir;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    fn test_root(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi_project_delete_{label}_{unique}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn test_state(label: &str) -> DbState {
        DbState::open_test_db(test_root(label))
    }

    #[test]
    fn project_delete_removes_db_row_first() {
        let st = test_state("project_delete");
        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let project_dir = st.root.join("projects").join(&project_id);
        fs::create_dir_all(&project_dir).unwrap();
        let audio_path = project_dir.join("clip.wav");
        fs::write(&audio_path, b"x").unwrap();
        let conn = super::super::utils::open_db(&st).unwrap();
        let t = super::super::utils::now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Del", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &file_id,
                &project_id,
                "clip.wav",
                "paired",
                audio_path.to_string_lossy().to_string(),
                t,
                t
            ],
        )
        .unwrap();
        drop(conn);

        project_delete_inner(&st, &project_id).unwrap();

        assert!(!project_storage_dir(&st.root, &project_id).exists());
        let conn = super::super::utils::open_db(&st).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE id = ?1",
                params![&project_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn project_delete_commits_db_even_when_storage_cleanup_fails() {
        // A regular file at projects/{id} makes remove_dir_all fail. The DB delete is
        // committed first, so a cleanup failure must not produce a reverse orphan: the
        // row is gone and the un-removable file remains as a sweepable orphan.
        let st = test_state("project_delete_cleanup_fail");
        let project_id = Uuid::new_v4().to_string();
        let projects_dir = st.root.join("projects");
        fs::create_dir_all(&projects_dir).unwrap();
        let stray = projects_dir.join(&project_id);
        fs::write(&stray, b"not-a-directory").unwrap();
        let conn = super::super::utils::open_db(&st).unwrap();
        let t = super::super::utils::now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Del", t, t],
        )
        .unwrap();
        drop(conn);

        project_delete_inner(&st, &project_id).unwrap();

        let conn = super::super::utils::open_db(&st).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE id = ?1",
                params![&project_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
        assert!(stray.exists());
    }
}

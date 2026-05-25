use super::utils::{append_desktop_log_line, open_db, remove_project_audio_parent_dir};
use crate::DbState;
use rusqlite::params;
use std::fs;
use std::ops::Deref;
use tauri::State;

pub(crate) fn project_delete_inner(st: &DbState, project_id: &str) -> Result<(), String> {
    let conn = open_db(st)?;
    let mut stmt = conn
        .prepare("SELECT audio_path FROM files WHERE project_id = ?1 AND audio_path IS NOT NULL")
        .map_err(|e| e.to_string())?;
    let audio_paths: Vec<String> = stmt
        .query_map(params![project_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let project_dir = st.root.join("projects").join(project_id);

    let deleted = conn
        .execute("DELETE FROM projects WHERE id = ?1", params![project_id])
        .map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err("项目不存在或已被删除。".into());
    }

    if let Some(first) = audio_paths.first() {
        if let Err(e) = remove_project_audio_parent_dir(&st.root, first) {
            append_desktop_log_line(
                st,
                &format!("WARN project_delete_fs_cleanup project_id={project_id} {e}"),
            );
        }
    } else if project_dir.exists() {
        if let Err(e) = fs::remove_dir(&project_dir) {
            append_desktop_log_line(
                st,
                &format!("WARN project_delete_empty_dir project_id={project_id} {e}"),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn project_delete(state: State<DbState>, project_id: String) -> Result<(), String> {
    project_delete_inner(state.deref(), &project_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
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
        let root = test_root(label);
        let db_path = root.join("rushi.sqlite3");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        db::migrate(&conn).unwrap();
        drop(conn);
        DbState { root, db_path }
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
}

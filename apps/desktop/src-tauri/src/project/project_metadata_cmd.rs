use super::types::ProjectDetail;
use super::utils::{now_ms, open_db, project_detail_from_conn};
use crate::DbState;
use rusqlite::params;
use std::ops::Deref;
use tauri::State;

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[tauri::command]
pub fn rename_project(
    state: State<DbState>,
    project_id: String,
    name: String,
) -> Result<ProjectDetail, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("项目名称不能为空。".to_string());
    }
    let conn = open_db(state.deref())?;
    let t = now_ms();
    let updated = conn
        .execute(
            "UPDATE projects SET name = ?1, updated_at_ms = ?2 WHERE id = ?3",
            params![trimmed, t, &project_id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err(format!("项目不存在：{project_id}"));
    }
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn update_project_metadata(
    state: State<DbState>,
    project_id: String,
    narrator: Option<String>,
    recorded_at: Option<String>,
    location: Option<String>,
    subject: Option<String>,
    transcriber: Option<String>,
) -> Result<ProjectDetail, String> {
    let conn = open_db(state.deref())?;
    let t = now_ms();
    let updated = conn
        .execute(
            "UPDATE projects SET \
             narrator = ?1, recorded_at = ?2, location = ?3, subject = ?4, transcriber = ?5, \
             updated_at_ms = ?6 WHERE id = ?7",
            params![
                normalize_optional_text(narrator),
                normalize_optional_text(recorded_at),
                normalize_optional_text(location),
                normalize_optional_text(subject),
                normalize_optional_text(transcriber),
                t,
                &project_id,
            ],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err(format!("项目不存在：{project_id}"));
    }
    project_detail_from_conn(&conn, &project_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::Connection;
    use uuid::Uuid;

    fn insert_project(conn: &Connection, project_id: &str, name: &str, t: i64) {
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![project_id, name, t, t],
        )
        .unwrap();
    }

    #[test]
    fn rename_project_updates_name_and_timestamp() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let project_id = Uuid::new_v4().to_string();
        let t = now_ms();
        insert_project(&conn, &project_id, "旧名称", t);
        conn.execute(
            "UPDATE projects SET name = ?1, updated_at_ms = ?2 WHERE id = ?3",
            params!["新名称", t + 1000, &project_id],
        )
        .unwrap();
        let detail = project_detail_from_conn(&conn, &project_id).unwrap();
        assert_eq!(detail.name, "新名称");
        assert!(detail.updated_at_ms > t);
    }

    #[test]
    fn update_project_metadata_round_trip() {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).unwrap();
        let project_id = Uuid::new_v4().to_string();
        let t = now_ms();
        insert_project(&conn, &project_id, "场次 A", t);
        conn.execute(
            "UPDATE projects SET narrator = ?1, recorded_at = ?2, location = ?3, subject = ?4, transcriber = ?5, updated_at_ms = ?6 WHERE id = ?7",
            params![
                Some("张三"),
                Some("2024-03"),
                Some("北京"),
                Some("家族史"),
                Some("李四"),
                t + 500,
                &project_id,
            ],
        )
        .unwrap();
        let detail = project_detail_from_conn(&conn, &project_id).unwrap();
        assert_eq!(detail.narrator.as_deref(), Some("张三"));
        assert_eq!(detail.recorded_at.as_deref(), Some("2024-03"));
        assert_eq!(detail.location.as_deref(), Some("北京"));
        assert_eq!(detail.subject.as_deref(), Some("家族史"));
        assert_eq!(detail.transcriber.as_deref(), Some("李四"));
    }

    #[test]
    fn normalize_optional_text_trims_and_nullifies_empty() {
        assert_eq!(normalize_optional_text(Some("  ".to_string())), None);
        assert_eq!(normalize_optional_text(Some("  讲述人  ".to_string())), Some("讲述人".to_string()));
        assert_eq!(normalize_optional_text(None), None);
    }
}

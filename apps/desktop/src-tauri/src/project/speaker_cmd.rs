use super::types::FileSpeakerDto;
use super::utils::{now_ms, open_db};
use crate::DbState;
use rusqlite::{params, OptionalExtension};
use std::ops::Deref;
use tauri::State;
use uuid::Uuid;

fn file_project_id(conn: &rusqlite::Connection, file_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT project_id FROM files WHERE id = ?1",
        params![file_id],
        |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "文件不存在。".to_string())
}

#[tauri::command]
pub fn file_create_speaker(
    state: State<DbState>,
    file_id: String,
    display_name: Option<String>,
) -> Result<FileSpeakerDto, String> {
    file_create_speaker_inner(state.deref(), &file_id, display_name)
}

pub(crate) fn file_create_speaker_inner(
    st: &DbState,
    file_id: &str,
    display_name: Option<String>,
) -> Result<FileSpeakerDto, String> {
    let mut conn = open_db(st)?;
    let project_id = file_project_id(&conn, &file_id)?;
    let ordinal: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(ordinal), 0) + 1 FROM file_speakers WHERE file_id = ?1",
            params![&file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let speaker_id = format!("spk:manual:{}", Uuid::new_v4());
    let display_name = display_name
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO file_speakers \
         (file_id, speaker_id, ordinal, display_name, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![&file_id, &speaker_id, ordinal, display_name.as_deref(), t],
    )
    .map_err(|e| e.to_string())?;
    touch_file_and_project(&tx, &file_id, &project_id, t)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(FileSpeakerDto {
        speaker_id,
        ordinal,
        display_name,
    })
}

#[tauri::command]
pub fn file_rename_speaker(
    state: State<DbState>,
    file_id: String,
    speaker_id: String,
    display_name: Option<String>,
) -> Result<(), String> {
    file_rename_speaker_inner(state.deref(), &file_id, &speaker_id, display_name)
}

pub(crate) fn file_rename_speaker_inner(
    st: &DbState,
    file_id: &str,
    speaker_id: &str,
    display_name: Option<String>,
) -> Result<(), String> {
    let mut conn = open_db(st)?;
    let project_id = file_project_id(&conn, &file_id)?;
    let display_name = display_name
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let updated = tx
        .execute(
            "UPDATE file_speakers SET display_name = ?1, updated_at_ms = ?2 \
             WHERE file_id = ?3 AND speaker_id = ?4",
            params![display_name.as_deref(), t, &file_id, &speaker_id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("说话人不存在。".to_string());
    }
    touch_file_and_project(&tx, &file_id, &project_id, t)?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn file_reassign_segments_speaker(
    state: State<DbState>,
    file_id: String,
    segment_uids: Vec<String>,
    speaker_id: Option<String>,
) -> Result<(), String> {
    file_reassign_segments_speaker_inner(state.deref(), &file_id, segment_uids, speaker_id)
}

pub(crate) fn file_reassign_segments_speaker_inner(
    st: &DbState,
    file_id: &str,
    segment_uids: Vec<String>,
    speaker_id: Option<String>,
) -> Result<(), String> {
    let segment_uids: Vec<String> = segment_uids
        .into_iter()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .collect();
    if segment_uids.is_empty() {
        return Err("请至少选择一个语段。".to_string());
    }
    let speaker_id = speaker_id
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let mut conn = open_db(st)?;
    let project_id = file_project_id(&conn, &file_id)?;
    if let Some(id) = speaker_id.as_deref() {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM file_speakers WHERE file_id = ?1 AND speaker_id = ?2)",
                params![&file_id, id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err("说话人不存在。".to_string());
        }
    }
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut updated = 0usize;
    for uid in &segment_uids {
        updated += tx
            .execute(
                "UPDATE segments SET speaker_id = ?1 WHERE file_id = ?2 AND uid = ?3",
                params![speaker_id.as_deref(), &file_id, uid],
            )
            .map_err(|e| e.to_string())?;
    }
    if updated != segment_uids.len() {
        return Err("部分语段不存在，未保存说话人修改。".to_string());
    }
    touch_file_and_project(&tx, &file_id, &project_id, t)?;
    tx.commit().map_err(|e| e.to_string())
}

fn touch_file_and_project(
    tx: &rusqlite::Transaction<'_>,
    file_id: &str,
    project_id: &str,
    at_ms: i64,
) -> Result<(), String> {
    tx.execute(
        "UPDATE files SET updated_at_ms = ?1 WHERE id = ?2",
        params![at_ms, file_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![at_ms, project_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn state() -> DbState {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi_speaker_cmd_{unique}"));
        fs::create_dir_all(&root).unwrap();
        DbState::open_test_db(root)
    }

    #[test]
    fn speaker_crud_reassign_and_file_cascade() {
        let st = state();
        let project_id = "project-speaker";
        let file_id = "file-speaker";
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, 'P', 1, 1)",
            params![project_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 'F', 'text', 1, 1)",
            params![file_id, project_id],
        )
        .unwrap();
        for (idx, uid) in [(0, "seg-a"), (1, "seg-b")] {
            conn.execute(
                "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text) \
                 VALUES (?1, ?2, ?3, ?3, ?3 + 1, 'x')",
                params![file_id, uid, idx],
            )
            .unwrap();
        }
        drop(conn);

        let speaker = file_create_speaker_inner(&st, file_id, Some(" 张三 ".into())).unwrap();
        assert_eq!(speaker.ordinal, 1);
        assert_eq!(speaker.display_name.as_deref(), Some("张三"));
        file_rename_speaker_inner(&st, file_id, &speaker.speaker_id, Some("李四".into())).unwrap();
        file_reassign_segments_speaker_inner(
            &st,
            file_id,
            vec!["seg-a".into(), "seg-b".into()],
            Some(speaker.speaker_id.clone()),
        )
        .unwrap();

        let conn = open_db(&st).unwrap();
        let assigned: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM segments WHERE file_id = ?1 AND speaker_id = ?2",
                params![file_id, &speaker.speaker_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(assigned, 2);
        let renamed: Option<String> = conn
            .query_row(
                "SELECT display_name FROM file_speakers WHERE file_id = ?1 AND speaker_id = ?2",
                params![file_id, &speaker.speaker_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(renamed.as_deref(), Some("李四"));
        conn.execute("DELETE FROM files WHERE id = ?1", params![file_id])
            .unwrap();
        let roster_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM file_speakers WHERE file_id = ?1",
                params![file_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(roster_count, 0);
    }
}

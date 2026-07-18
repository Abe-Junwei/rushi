use super::file_name_unique::{name_taken, unique_file_name};
use super::project_storage::{
    cleanup_deleted_file_storage, copy_file_storage_between_projects, project_storage_dir,
    relocate_file_storage_between_projects,
};
use super::types::{FileDetail, FileSummary};
use super::utils::{file_detail_from_conn, list_file_summaries, now_ms, open_db};
use crate::DbState;
use rusqlite::{params, Error};
use serde::Serialize;
use std::ops::Deref;
use tauri::State;
use uuid::Uuid;

fn project_exists(conn: &rusqlite::Connection, project_id: &str) -> Result<bool, String> {
    match conn.query_row(
        "SELECT 1 FROM projects WHERE id = ?1",
        params![project_id],
        |_| Ok(()),
    ) {
        Ok(()) => Ok(true),
        Err(Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePlacementResult {
    pub file_id: String,
    pub final_name: String,
    pub renamed: bool,
}

#[tauri::command]
pub fn list_files(state: State<DbState>, project_id: String) -> Result<Vec<FileSummary>, String> {
    let st = state.deref();
    let conn = open_db(st)?;
    list_file_summaries(&conn, &project_id, Some(st))
}

#[tauri::command]
pub fn load_file(state: State<DbState>, file_id: String) -> Result<FileDetail, String> {
    let st = state.deref();
    let conn = open_db(st)?;
    let detail = file_detail_from_conn(&conn, &file_id)?;
    drop(conn);
    if let Some(ref raw) = detail.audio_path {
        if let Ok(path) = crate::media_base_dir::resolve_audio_path(st, raw) {
            crate::project::utils::persist_probed_file_duration(st, &file_id, &path);
        }
    }
    // Re-read so Hub callers / openFile see freshly probed duration_sec.
    let conn = open_db(st)?;
    file_detail_from_conn(&conn, &file_id)
}

#[tauri::command]
pub fn rename_file(state: State<DbState>, file_id: String, name: String) -> Result<(), String> {
    rename_file_inner(state.deref(), &file_id, &name)
}

pub(crate) fn rename_file_inner(st: &DbState, file_id: &str, name: &str) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("文件名不能为空。".into());
    }
    let mut conn = open_db(st)?;
    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![file_id],
            |r| r.get(0),
        )
        .map_err(|_| "文件不存在。".to_string())?;
    if name_taken(&conn, name, Some(file_id))? {
        return Err("该名称已存在。".into());
    }
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE files SET name = ?1, updated_at_ms = ?2 WHERE id = ?3",
        params![name, t, file_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a file by id (DB + media/peaks). Used by UI and content-package overwrite.
pub(crate) fn delete_file_inner(st: &DbState, file_id: &str) -> Result<(), String> {
    let mut conn = open_db(st)?;

    let audio_path: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT audio_path FROM files WHERE id = ?1",
        params![file_id],
        |r| r.get(0),
    );

    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM files WHERE id = ?1", params![file_id])
        .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    if let Ok(p) = audio_path {
        cleanup_deleted_file_storage(st, &project_id, file_id, Some(p.as_str()));
    } else {
        cleanup_deleted_file_storage(st, &project_id, file_id, None);
    }

    Ok(())
}

#[tauri::command]
pub fn delete_file(state: State<DbState>, file_id: String) -> Result<(), String> {
    let st: &DbState = state.deref();
    delete_file_inner(st, &file_id)
}

#[tauri::command]
pub fn move_file_to_project(
    state: State<DbState>,
    file_id: String,
    dest_project_id: String,
) -> Result<FilePlacementResult, String> {
    move_file_to_project_inner(state.deref(), &file_id, &dest_project_id)
}

pub(crate) fn move_file_to_project_inner(
    st: &DbState,
    file_id: &str,
    dest_project_id: &str,
) -> Result<FilePlacementResult, String> {
    let mut conn = open_db(st)?;

    let dest_exists = project_exists(&conn, dest_project_id)?;
    if !dest_exists {
        return Err("目标项目不存在。".into());
    }

    let (source_project_id, name, audio_path): (String, String, Option<String>) = conn
        .query_row(
            "SELECT project_id, name, audio_path FROM files WHERE id = ?1",
            params![file_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|_| "文件不存在。".to_string())?;

    if source_project_id == dest_project_id {
        return Ok(FilePlacementResult {
            file_id: file_id.to_string(),
            final_name: name,
            renamed: false,
        });
    }

    let final_name = unique_file_name(&conn, &name, Some(file_id))?;
    let renamed = final_name != name;

    // Disk first, then DB transaction; roll back storage if commit fails.
    let new_audio = relocate_file_storage_between_projects(
        st,
        file_id,
        &source_project_id,
        dest_project_id,
        audio_path.as_deref(),
    )?;
    let effective_audio = new_audio.as_deref().or(audio_path.as_deref());

    let t = now_ms();
    let tx_result = (|| -> Result<(), String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE files SET project_id = ?1, name = ?2, audio_path = ?3, updated_at_ms = ?4 WHERE id = ?5",
            params![
                dest_project_id,
                &final_name,
                effective_audio,
                t,
                file_id
            ],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
            params![t, &source_project_id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
            params![t, dest_project_id],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if let Err(e) = tx_result {
        if let Err(rb) = relocate_file_storage_between_projects(
            st,
            file_id,
            dest_project_id,
            &source_project_id,
            effective_audio,
        ) {
            return Err(format!("{e}（且存储回滚失败: {rb}）"));
        }
        return Err(e);
    }

    Ok(FilePlacementResult {
        file_id: file_id.to_string(),
        final_name,
        renamed,
    })
}

#[tauri::command]
pub fn copy_file_to_project(
    state: State<DbState>,
    file_id: String,
    dest_project_id: String,
) -> Result<FilePlacementResult, String> {
    copy_file_to_project_inner(state.deref(), &file_id, &dest_project_id)
}

pub(crate) fn copy_file_to_project_inner(
    st: &DbState,
    file_id: &str,
    dest_project_id: &str,
) -> Result<FilePlacementResult, String> {
    let mut conn = open_db(st)?;

    let dest_exists = project_exists(&conn, dest_project_id)?;
    if !dest_exists {
        return Err("目标项目不存在。".into());
    }

    type CopySourceRow = (
        String,
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<i64>,
        Option<i64>,
    );
    let (
        source_project_id,
        name,
        file_type,
        audio_path,
        import_source_path,
        import_content_sha256,
        import_source_size,
        import_source_modified_ms,
    ): CopySourceRow = conn
        .query_row(
            "SELECT project_id, name, file_type, audio_path, import_source_path, import_content_sha256, \
             import_source_size, import_source_modified_ms FROM files WHERE id = ?1",
            params![file_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                ))
            },
        )
        .map_err(|_| "文件不存在。".to_string())?;

    let final_name = unique_file_name(&conn, &name, None)?;
    let renamed = final_name != name;
    let new_file_id = Uuid::new_v4().to_string();

    type SegRow = (
        i64,
        f64,
        f64,
        String,
        Option<f64>,
        i64,
        String,
        Option<String>,
        String,
        Option<String>,
        String,
        i64,
    );
    let segs: Vec<SegRow> = {
        let mut stmt = conn
            .prepare(
                "SELECT idx, start_sec, end_sec, text, confidence, low_confidence, detail, kind, \
                 text_stage, finalize_via, annotation, frozen FROM segments WHERE file_id = ?1 ORDER BY idx ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![file_id], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, f64>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, Option<f64>>(4)?,
                    r.get::<_, i64>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, Option<String>>(7)?,
                    r.get::<_, String>(8)?,
                    r.get::<_, Option<String>>(9)?,
                    r.get::<_, String>(10)?,
                    r.get::<_, i64>(11)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    // Disk first so a failed copy never leaves a DB row sharing the source audio.
    let new_audio = copy_file_storage_between_projects(
        st,
        file_id,
        &new_file_id,
        &source_project_id,
        dest_project_id,
        audio_path.as_deref(),
    );
    let new_audio = match new_audio {
        Ok(path) => path,
        Err(e) => {
            cleanup_deleted_file_storage(st, dest_project_id, &new_file_id, None);
            return Err(e);
        }
    };
    let effective_audio = new_audio.as_deref().or(audio_path.as_deref());

    let t = now_ms();
    let tx_result = (|| -> Result<(), String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, import_source_path, \
             import_content_sha256, import_source_size, import_source_modified_ms, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                &new_file_id,
                dest_project_id,
                &final_name,
                &file_type,
                effective_audio,
                import_source_path.as_deref(),
                import_content_sha256.as_deref(),
                import_source_size,
                import_source_modified_ms,
                t,
                t,
            ],
        )
        .map_err(|e| e.to_string())?;

        for (
            idx,
            start_sec,
            end_sec,
            text,
            confidence,
            low_confidence,
            detail,
            kind,
            text_stage,
            finalize_via,
            annotation,
            frozen,
        ) in &segs
        {
            let uid = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, \
                 low_confidence, detail, kind, text_stage, finalize_via, annotation, frozen) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    &new_file_id,
                    &uid,
                    idx,
                    start_sec,
                    end_sec,
                    text,
                    confidence,
                    low_confidence,
                    detail,
                    kind,
                    text_stage,
                    finalize_via,
                    annotation,
                    frozen,
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        tx.execute(
            "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
            params![t, dest_project_id],
        )
        .map_err(|e| e.to_string())?;
        if source_project_id != dest_project_id {
            tx.execute(
                "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
                params![t, &source_project_id],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if let Err(e) = tx_result {
        cleanup_deleted_file_storage(st, dest_project_id, &new_file_id, effective_audio);
        return Err(e);
    }

    Ok(FilePlacementResult {
        file_id: new_file_id,
        final_name,
        renamed,
    })
}

#[tauri::command]
pub fn reveal_project_in_file_manager(
    state: State<DbState>,
    project_id: String,
) -> Result<(), String> {
    let st = state.deref();
    let conn = open_db(st)?;
    let exists = project_exists(&conn, &project_id)?;
    if !exists {
        return Err("项目不存在。".into());
    }
    let dir = project_storage_dir(&st.root, &project_id);
    super::export_cmd::open_folder_in_file_manager(&dir)
}

#[tauri::command]
pub fn reveal_file_in_file_manager(state: State<DbState>, file_id: String) -> Result<(), String> {
    let st = state.deref();
    let conn = open_db(st)?;
    let (project_id, audio_path): (String, Option<String>) = conn
        .query_row(
            "SELECT project_id, audio_path FROM files WHERE id = ?1",
            params![&file_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "文件不存在。".to_string())?;

    if let Some(path) = audio_path.filter(|p| !p.is_empty()) {
        if let Ok(pb) = crate::media_base_dir::resolve_audio_path(st, &path) {
            return super::export_cmd::reveal_file_selected_in_file_manager(&pb);
        }
    }
    let dir = project_storage_dir(&st.root, &project_id);
    super::export_cmd::open_folder_in_file_manager(&dir)
}

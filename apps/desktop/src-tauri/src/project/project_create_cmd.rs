use super::import_parse::{parse_srt, parse_txt};
use super::segment_uid::segment_uid_or_new;
use super::types::ProjectDetail;
use super::utils::{canonicalize_audio_storage_path, now_ms, open_db, project_detail_from_conn};
use crate::DbState;
use rusqlite::params;
use std::fs;
use std::io::ErrorKind;
use std::ops::Deref;
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

fn copy_audio_with_context(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    fs::copy(src, dest).map_err(|e| {
        let base = format!(
            "导入音频失败: {e} (source: {}, dest: {})",
            src.display(),
            dest.display()
        );
        if e.kind() == ErrorKind::PermissionDenied {
            format!(
                "{base}。权限不足（os error 13），请确认源文件可读、项目目录可写；若音频来自外部磁盘/受保护目录，请为应用授予文件访问权限。"
            )
        } else {
            base
        }
    })?;
    Ok(())
}

#[tauri::command]
pub fn project_create_from_audio(
    state: State<DbState>,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("dat")
        .to_ascii_lowercase();
    let project_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let dest_dir = st.root.join("projects").join(&project_id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest_audio = dest_dir.join(format!("{file_id}.{ext}"));
    copy_audio_with_context(&src, &dest_audio).inspect_err(|_| {
        let _ = fs::remove_dir_all(&dest_dir);
    })?;
    let dest_str = canonicalize_audio_storage_path(&dest_audio).inspect_err(|_| {
        let _ = fs::remove_dir_all(&dest_dir);
    })?;
    let t = now_ms();
    let mut conn = open_db(st)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if let Err(e) = tx.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, &name, t, t],
    ) {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(e.to_string());
    }
    if let Err(e) = tx.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&file_id, &project_id, &name, "paired", &dest_str, t, t],
    ) {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(e.to_string());
    }
    tx.commit().map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn create_empty_project(state: State<DbState>, name: String) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let project_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, &name, t, t],
    )
    .map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn create_project_from_text(
    state: State<DbState>,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_ascii_lowercase();
    let content = fs::read_to_string(&src).map_err(|e| format!("读取文件失败: {e}"))?;
    let segments = if ext == "srt" {
        parse_srt(&content)?
    } else {
        parse_txt(&content)
    };
    let project_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let mut conn = open_db(st)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, &name, t, t],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, &name, "text", t, t],
    )
    .map_err(|e| e.to_string())?;
    for s in &segments {
        let uid = segment_uid_or_new(&s.uid);
        tx.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &file_id,
                uid.as_str(),
                s.idx,
                s.start_sec,
                s.end_sec,
                s.text.as_str(),
                s.confidence,
                if s.low_confidence { 1i64 } else { 0i64 },
                s.detail.as_deref().unwrap_or(""),
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn create_empty_text_file(
    state: State<DbState>,
    project_id: String,
    name: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, &name, "text", t, t],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn import_audio_to_project(
    state: State<DbState>,
    project_id: String,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("dat")
        .to_ascii_lowercase();
    let file_id = Uuid::new_v4().to_string();
    let dest_dir = st.root.join("projects").join(&project_id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest_audio = dest_dir.join(format!("{file_id}.{ext}"));
    copy_audio_with_context(&src, &dest_audio)?;
    let dest_str = canonicalize_audio_storage_path(&dest_audio)?;
    let t = now_ms();
    let conn = open_db(st)?;
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&file_id, &project_id, &name, "paired", &dest_str, t, t],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

#[tauri::command]
pub fn import_text_to_project(
    state: State<DbState>,
    project_id: String,
    name: String,
    src_path: String,
) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_ascii_lowercase();
    let content = fs::read_to_string(&src).map_err(|e| format!("读取文件失败: {e}"))?;
    let segments = if ext == "srt" {
        parse_srt(&content)?
    } else {
        parse_txt(&content)
    };
    let file_id = Uuid::new_v4().to_string();
    let t = now_ms();
    let mut conn = open_db(st)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&file_id, &project_id, &name, "text", t, t],
    )
    .map_err(|e| e.to_string())?;
    for s in &segments {
        let uid = segment_uid_or_new(&s.uid);
        tx.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &file_id,
                uid.as_str(),
                s.idx,
                s.start_sec,
                s.end_sec,
                s.text.as_str(),
                s.confidence,
                if s.low_confidence { 1i64 } else { 0i64 },
                s.detail.as_deref().unwrap_or(""),
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    project_detail_from_conn(&conn, &project_id)
}

use crate::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::types::{ProjectDetail, SegmentDto};
use super::utils::{now_ms, open_db, project_detail_from_conn};

const PROJECT_BUNDLE_KIND: &str = "rushi_project_bundle";
const PROJECT_BUNDLE_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct ProjectBundleManifest {
    kind: String,
    version: u32,
    exported_at_ms: i64,
    project: ProjectBundleProjectMeta,
    audio_file: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProjectBundleProjectMeta {
    original_id: String,
    name: String,
    created_at_ms: i64,
    updated_at_ms: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProjectBundleDocument {
    name: String,
    created_at_ms: i64,
    updated_at_ms: i64,
    segments: Vec<SegmentDto>,
}

fn zip_opts() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

fn read_zip_bytes(archive: &mut ZipArchive<File>, name: &str) -> Result<Vec<u8>, String> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| format!("项目包缺少 {name}: {e}"))?;
    let mut out = Vec::new();
    file.read_to_end(&mut out)
        .map_err(|e| format!("读取项目包文件失败 {name}: {e}"))?;
    Ok(out)
}

fn read_zip_json<T: for<'de> Deserialize<'de>>(
    archive: &mut ZipArchive<File>,
    name: &str,
) -> Result<T, String> {
    let bytes = read_zip_bytes(archive, name)?;
    serde_json::from_slice(&bytes).map_err(|e| format!("解析项目包文件失败 {name}: {e}"))
}

fn export_project_bundle_to_path(
    st: &DbState,
    project_id: &str,
    zip_path: &Path,
    segments: Vec<SegmentDto>,
) -> Result<String, String> {
    if zip_path.exists() {
        return Err("目标文件已存在，请另选文件名或先删除该文件。".into());
    }

    let conn = open_db(st)?;
    let (name, created_at_ms, updated_at_ms): (String, i64, i64) = conn
        .query_row(
            "SELECT name, created_at_ms, updated_at_ms FROM projects WHERE id = ?1",
            params![project_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    // For backward-compat in Slice 1: use the first paired file's audio
    let (audio_storage_path,): (String,) = conn
        .query_row(
            "SELECT audio_path FROM files WHERE project_id = ?1 AND audio_path IS NOT NULL LIMIT 1",
            params![project_id],
            |r| Ok((r.get(0)?,)),
        )
        .map_err(|e| format!("项目中无可导出音频: {e}"))?;

    let audio_path = PathBuf::from(&audio_storage_path);
    if !audio_path.is_file() {
        return Err(format!("项目音频不存在：{audio_storage_path}"));
    }
    let audio_file = audio_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "项目音频文件名无效。".to_string())?
        .to_string();
    let audio_bytes = fs::read(&audio_path).map_err(|e| format!("读取项目音频失败: {e}"))?;

    let doc = ProjectBundleDocument {
        name: name.clone(),
        created_at_ms,
        updated_at_ms,
        segments,
    };
    let manifest = ProjectBundleManifest {
        kind: PROJECT_BUNDLE_KIND.to_string(),
        version: PROJECT_BUNDLE_VERSION,
        exported_at_ms: now_ms(),
        project: ProjectBundleProjectMeta {
            original_id: project_id.to_string(),
            name,
            created_at_ms,
            updated_at_ms,
        },
        audio_file: audio_file.clone(),
    };

    let tmp_path = zip_path.with_extension("zip.part");
    let file = File::create(&tmp_path).map_err(|e| format!("创建项目包失败: {e}"))?;
    let mut zip = ZipWriter::new(file);

    zip.start_file("manifest.json", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(
        &serde_json::to_vec_pretty(&manifest).map_err(|e| format!("序列化 manifest 失败: {e}"))?,
    )
    .map_err(|e| e.to_string())?;

    zip.start_file("project.json", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(
        &serde_json::to_vec_pretty(&doc).map_err(|e| format!("序列化项目数据失败: {e}"))?,
    )
    .map_err(|e| e.to_string())?;

    zip.start_file(format!("audio/{audio_file}"), zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(&audio_bytes).map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| format!("完成项目包失败: {e}"))?;
    fs::rename(&tmp_path, zip_path).map_err(|e| format!("保存项目包失败: {e}"))?;
    Ok(zip_path.to_string_lossy().to_string())
}

fn import_project_bundle_from_path(st: &DbState, zip_path: &Path) -> Result<ProjectDetail, String> {
    let file = File::open(zip_path).map_err(|e| format!("打开项目包失败: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("读取项目包失败: {e}"))?;
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json")?;
    if manifest.kind != PROJECT_BUNDLE_KIND {
        return Err("无法导入：不是受支持的 Rushi 项目包。".into());
    }
    if manifest.version != PROJECT_BUNDLE_VERSION {
        return Err(format!(
            "无法导入：项目包版本 {} 与当前支持版本 {} 不匹配。",
            manifest.version, PROJECT_BUNDLE_VERSION
        ));
    }
    let Some(audio_file_name) = Path::new(&manifest.audio_file).file_name().and_then(|n| n.to_str()) else {
        return Err("无法导入：项目包内音频文件名无效。".into());
    };
    if audio_file_name != manifest.audio_file {
        return Err("无法导入：项目包内音频路径不安全。".into());
    }

    let doc: ProjectBundleDocument = read_zip_json(&mut archive, "project.json")?;
    let audio_bytes = read_zip_bytes(&mut archive, &format!("audio/{audio_file_name}"))?;

    let id = Uuid::new_v4().to_string();
    let dest_dir = st.root.join("projects").join(&id);
    fs::create_dir_all(&dest_dir).map_err(|e| format!("创建项目目录失败: {e}"))?;
    let ext = Path::new(audio_file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("dat")
        .to_ascii_lowercase();
    let dest_audio = dest_dir.join(format!("audio.{ext}"));
    if let Err(e) = fs::write(&dest_audio, &audio_bytes) {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(format!("写入项目音频失败: {e}"));
    }

    let imported_name = if doc.name.trim().is_empty() {
        manifest.project.name.trim()
    } else {
        doc.name.trim()
    };
    let now = now_ms();
    let created_at_ms = if doc.created_at_ms > 0 { doc.created_at_ms } else { now };
    let mut normalized_segments = doc.segments;
    normalized_segments.sort_by_key(|s| s.idx);

    let db_result = (|| -> Result<(), String> {
        let mut conn = open_db(st)?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![
                &id,
                imported_name,
                created_at_ms,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        let file_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &file_id,
                &id,
                imported_name,
                "paired",
                dest_audio.to_string_lossy().to_string(),
                created_at_ms,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        for (idx, s) in normalized_segments.iter().enumerate() {
            let low = if s.low_confidence { 1i64 } else { 0i64 };
            let detail = s.detail.as_deref().unwrap_or("");
            tx.execute(
                "INSERT INTO segments (file_id, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    &file_id,
                    idx as i32,
                    s.start_sec,
                    s.end_sec,
                    s.text.as_str(),
                    s.confidence,
                    low,
                    detail,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        let detail = serde_json::json!({
            "op": "import_project_bundle",
            "source_project_id": manifest.project.original_id,
            "source_updated_at_ms": manifest.project.updated_at_ms,
            "source_zip": zip_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown"),
            "segment_count": normalized_segments.len(),
            "at_ms": now,
        })
        .to_string();
        tx.execute(
            "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
            params![&id, now, "import_project_bundle", detail.as_str()],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if let Err(e) = db_result {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(e);
    }

    let conn = open_db(st)?;
    project_detail_from_conn(&conn, &id)
}

/// 弹出系统「另存为」并写入 UTF-8 文本（Tauri WebView 内程序化 `<a download>` 常无效果）。
#[tauri::command]
pub fn export_text_file(
    default_filename: String,
    content: String,
) -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_file_name(&default_filename)
        .save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    if path.exists() {
        return Err("目标文件已存在，请另选文件名或先删除该文件。".into());
    }
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {e}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn export_project_bundle(
    state: State<DbState>,
    project_id: String,
    default_filename: String,
    segments: Vec<SegmentDto>,
) -> Result<Option<String>, String> {
    let st: &DbState = state.deref();
    let picked = rfd::FileDialog::new()
        .add_filter("ZIP", &["zip"])
        .set_file_name(&default_filename)
        .save_file();
    let Some(zip_path) = picked else {
        return Ok(None);
    };
    export_project_bundle_to_path(st, &project_id, &zip_path, segments).map(Some)
}

#[tauri::command]
pub fn import_project_bundle(state: State<DbState>) -> Result<Option<ProjectDetail>, String> {
    let st: &DbState = state.deref();
    let picked = rfd::FileDialog::new()
        .add_filter("ZIP", &["zip"])
        .pick_file();
    let Some(zip_path) = picked else {
        return Ok(None);
    };
    import_project_bundle_from_path(st, &zip_path).map(Some)
}

fn reveal_path_in_file_manager(path: &Path) -> Result<(), String> {
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 在系统文件管理器中打开应用数据根目录（含 `models/`、`rushi.sqlite3` 等）。
#[tauri::command]
pub fn open_app_data_folder(state: State<DbState>) -> Result<(), String> {
    let st: &DbState = state.deref();
    reveal_path_in_file_manager(&st.root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi_export_cmd_{label}_{unique}"));
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

    fn seed_project(st: &DbState, project_id: &str, name: &str, audio_name: &str) -> PathBuf {
        let project_dir = st.root.join("projects").join(project_id);
        fs::create_dir_all(&project_dir).unwrap();
        let audio_path = project_dir.join(audio_name);
        fs::write(&audio_path, b"test-audio-bytes").unwrap();
        let conn = open_db(st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![project_id, name, 11i64, 22i64],
        )
        .unwrap();
        let file_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&file_id, project_id, name, "paired", audio_path.to_string_lossy().to_string(), 11i64, 22i64],
        )
        .unwrap();
        audio_path
    }

    #[test]
    fn export_and_import_project_bundle_round_trip() {
        let export_state = test_state("round_trip_export");
        let project_id = "project-export-1";
        seed_project(&export_state, project_id, "示例项目", "audio.wav");
        let export_zip = export_state.root.join("bundle.zip");
        let exported_segments = vec![
            SegmentDto {
                idx: 0,
                start_sec: 0.0,
                end_sec: 1.2,
                text: "第一句".into(),
                confidence: Some(0.9),
                low_confidence: false,
                detail: Some("ok".into()),
            },
            SegmentDto {
                idx: 1,
                start_sec: 1.2,
                end_sec: 2.4,
                text: "第二句".into(),
                confidence: None,
                low_confidence: true,
                detail: None,
            },
        ];

        let written = export_project_bundle_to_path(
            &export_state,
            project_id,
            &export_zip,
            exported_segments.clone(),
        )
        .unwrap();
        assert_eq!(written, export_zip.to_string_lossy().to_string());
        assert!(export_zip.is_file());

        let mut archive = ZipArchive::new(File::open(&export_zip).unwrap()).unwrap();
        let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json").unwrap();
        assert_eq!(manifest.kind, PROJECT_BUNDLE_KIND);
        assert_eq!(manifest.version, PROJECT_BUNDLE_VERSION);
        assert_eq!(manifest.project.original_id, project_id);
        assert_eq!(manifest.audio_file, "audio.wav");
        let doc: ProjectBundleDocument = read_zip_json(&mut archive, "project.json").unwrap();
        assert_eq!(doc.name, "示例项目");
        assert_eq!(doc.segments.len(), 2);
        assert_eq!(doc.segments[0].text, "第一句");
        let audio_bytes = read_zip_bytes(&mut archive, "audio/audio.wav").unwrap();
        assert_eq!(audio_bytes, b"test-audio-bytes");

        let import_state = test_state("round_trip_import");
        let imported = import_project_bundle_from_path(&import_state, &export_zip).unwrap();
        assert_eq!(imported.name, "示例项目");
        assert_ne!(imported.id, project_id);
        assert_eq!(imported.files.len(), 1);
        assert_eq!(imported.files[0].file_type, "paired");

        let conn = open_db(&import_state).unwrap();
        let imported_edit_kind: String = conn
            .query_row(
                "SELECT kind FROM edit_log WHERE project_id = ?1 ORDER BY id DESC LIMIT 1",
                params![&imported.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(imported_edit_kind, "import_project_bundle");

        let _ = fs::remove_dir_all(&export_state.root);
        let _ = fs::remove_dir_all(&import_state.root);
    }

    #[test]
    fn import_project_bundle_rejects_unsafe_audio_path() {
        let st = test_state("unsafe_path");
        let zip_path = st.root.join("unsafe.zip");
        let file = File::create(&zip_path).unwrap();
        let mut zip = ZipWriter::new(file);
        let manifest = ProjectBundleManifest {
            kind: PROJECT_BUNDLE_KIND.to_string(),
            version: PROJECT_BUNDLE_VERSION,
            exported_at_ms: 1,
            project: ProjectBundleProjectMeta {
                original_id: "source-id".into(),
                name: "原项目".into(),
                created_at_ms: 2,
                updated_at_ms: 3,
            },
            audio_file: "audio/../../evil.wav".into(),
        };
        let doc = ProjectBundleDocument {
            name: "导入项目".into(),
            created_at_ms: 2,
            updated_at_ms: 3,
            segments: vec![],
        };
        zip.start_file("manifest.json", zip_opts()).unwrap();
        zip.write_all(&serde_json::to_vec(&manifest).unwrap()).unwrap();
        zip.start_file("project.json", zip_opts()).unwrap();
        zip.write_all(&serde_json::to_vec(&doc).unwrap()).unwrap();
        zip.finish().unwrap();

        let err = import_project_bundle_from_path(&st, &zip_path).unwrap_err();
        assert!(err.contains("音频路径不安全"));

        let _ = fs::remove_dir_all(&st.root);
    }
}

use crate::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::segment_uid::segment_uid_or_new;
use super::types::{ProjectDetail, SegmentDto};
use super::utils::{canonicalize_audio_storage_path, now_ms, open_db, project_detail_from_conn};

pub(super) const PROJECT_BUNDLE_KIND: &str = "rushi_project_bundle";
pub(super) const PROJECT_BUNDLE_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleManifest {
    pub(super) kind: String,
    pub(super) version: u32,
    pub(super) exported_at_ms: i64,
    pub(super) project: ProjectBundleProjectMeta,
    pub(super) audio_file: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleProjectMeta {
    pub(super) original_id: String,
    pub(super) name: String,
    pub(super) created_at_ms: i64,
    pub(super) updated_at_ms: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct ProjectBundleDocument {
    pub(super) name: String,
    pub(super) created_at_ms: i64,
    pub(super) updated_at_ms: i64,
    pub(super) segments: Vec<SegmentDto>,
}

pub(super) fn zip_opts() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

pub(super) fn read_zip_bytes(
    archive: &mut ZipArchive<File>,
    name: &str,
) -> Result<Vec<u8>, String> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| format!("项目包缺少 {name}: {e}"))?;
    let mut out = Vec::new();
    file.read_to_end(&mut out)
        .map_err(|e| format!("读取项目包文件失败 {name}: {e}"))?;
    Ok(out)
}

pub(super) fn read_zip_json<T: for<'de> Deserialize<'de>>(
    archive: &mut ZipArchive<File>,
    name: &str,
) -> Result<T, String> {
    let bytes = read_zip_bytes(archive, name)?;
    serde_json::from_slice(&bytes).map_err(|e| format!("解析项目包文件失败 {name}: {e}"))
}

pub(super) fn export_project_bundle_to_path(
    st: &DbState,
    project_id: &str,
    file_id: &str,
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

    let (audio_storage_path,): (String,) = conn
        .query_row(
            "SELECT audio_path FROM files WHERE id = ?1 AND project_id = ?2 AND audio_path IS NOT NULL",
            params![file_id, project_id],
            |r| Ok((r.get(0)?,)),
        )
        .map_err(|_| "该文件没有可导出的音频，或文件不属于当前项目。".to_string())?;

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

    if let Err(e) = zip.finish().map_err(|e| format!("完成项目包失败: {e}")) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }
    if let Err(e) = fs::rename(&tmp_path, zip_path).map_err(|e| format!("保存项目包失败: {e}"))
    {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }
    Ok(zip_path.to_string_lossy().to_string())
}

pub(super) fn import_project_bundle_from_path(
    st: &DbState,
    zip_path: &Path,
) -> Result<ProjectDetail, String> {
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
    let Some(audio_file_name) = Path::new(&manifest.audio_file)
        .file_name()
        .and_then(|n| n.to_str())
    else {
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
    let audio_path = canonicalize_audio_storage_path(&dest_audio).inspect_err(|_| {
        let _ = fs::remove_dir_all(&dest_dir);
    })?;

    let imported_name = if doc.name.trim().is_empty() {
        manifest.project.name.trim()
    } else {
        doc.name.trim()
    };
    let now = now_ms();
    let created_at_ms = if doc.created_at_ms > 0 {
        doc.created_at_ms
    } else {
        now
    };
    let mut normalized_segments = doc.segments;
    normalized_segments.sort_by_key(|s| s.idx);

    let db_result = (|| -> Result<(), String> {
        let mut conn = open_db(st)?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&id, imported_name, created_at_ms, now],
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
                audio_path,
                created_at_ms,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        for (idx, s) in normalized_segments.iter().enumerate() {
            let uid = segment_uid_or_new(&s.uid);
            let low = if s.low_confidence { 1i64 } else { 0i64 };
            let detail = s.detail.as_deref().unwrap_or("");
            tx.execute(
                "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    &file_id,
                    uid.as_str(),
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

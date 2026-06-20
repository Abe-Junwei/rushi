//! Attach / replace transcript import (SRT/TXT) onto project files.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::params;
use tauri::State;

use super::import_duplicate::{
    import_file_display_name, import_provenance_for_src, ImportFileKind,
};
use super::import_parse::{parse_srt, parse_txt};
use super::project_create_cmd::import_text_to_project_inner;
use super::segment_uid::segment_uid_or_new;
use super::types::{FileSummary, ProjectDetail, SegmentDto};
use super::utils::{file_detail_from_conn, now_ms, open_db, project_detail_from_conn};
use crate::DbState;

#[derive(Debug, serde::Serialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum TranscriptImportOutcome {
    Attached {
        project: ProjectDetail,
        file_id: String,
    },
    CreatedText {
        project: ProjectDetail,
        file_id: String,
    },
    NeedTarget {
        candidates: Vec<FileSummary>,
        transcript_stem: String,
    },
}

fn transcript_stem(src_path: &str) -> String {
    import_file_display_name(src_path, ImportFileKind::Text)
}

fn parse_transcript_segments(src: &Path) -> Result<Vec<SegmentDto>, String> {
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_ascii_lowercase();
    let content = fs::read_to_string(src).map_err(|e| format!("读取文件失败: {e}"))?;
    if ext == "srt" {
        parse_srt(&content)
    } else {
        Ok(parse_txt(&content))
    }
}

fn list_stem_attach_candidates(
    conn: &rusqlite::Connection,
    project_id: &str,
    stem: &str,
) -> Result<Vec<FileSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, file_type, updated_at_ms FROM files \
             WHERE project_id = ?1 AND file_type IN ('paired', 'audio_only') AND name = ?2 \
             ORDER BY updated_at_ms DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id, stem], |r| {
            Ok(FileSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                file_type: r.get(2)?,
                updated_at_ms: r.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn insert_segments(
    tx: &rusqlite::Transaction<'_>,
    file_id: &str,
    segments: &[SegmentDto],
) -> Result<(), String> {
    for s in segments {
        let uid = segment_uid_or_new(&s.uid);
        tx.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                file_id,
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
    Ok(())
}

pub(crate) fn import_transcript_to_file_inner(
    st: &DbState,
    file_id: &str,
    src_path: &str,
    expected_project_id: Option<&str>,
) -> Result<FileSummary, String> {
    let src = PathBuf::from(src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let segments = parse_transcript_segments(&src)?;
    if segments.is_empty() {
        return Err("字幕文件未解析到任何语段".to_string());
    }
    let t = now_ms();
    let mut conn = open_db(st)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let (file_project_id, audio_path): (String, Option<String>) = tx
        .query_row(
            "SELECT project_id, audio_path FROM files WHERE id = ?1",
            params![file_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| format!("文件不存在: {file_id}"))?;
    if let Some(expected) = expected_project_id {
        if file_project_id != expected {
            return Err(format!("文件不属于当前项目: {file_id}"));
        }
    }
    let file_type = if audio_path.as_deref().unwrap_or("").is_empty() {
        "text"
    } else {
        "paired"
    };
    tx.execute("DELETE FROM segments WHERE file_id = ?1", params![file_id])
        .map_err(|e| e.to_string())?;
    insert_segments(&tx, file_id, &segments)?;
    let has_audio = !audio_path.as_deref().unwrap_or("").is_empty();
    if has_audio {
        tx.execute(
            "UPDATE files SET file_type = ?1, updated_at_ms = ?2 WHERE id = ?3",
            params![file_type, t, file_id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        let provenance = import_provenance_for_src(src_path)?;
        tx.execute(
            "UPDATE files SET file_type = ?1, import_source_path = ?2, import_content_sha256 = ?3, \
             import_source_size = ?4, import_source_modified_ms = ?5, updated_at_ms = ?6 WHERE id = ?7",
            params![
                file_type,
                &provenance.source_path,
                &provenance.content_sha256,
                provenance.source_size,
                provenance.source_modified_ms,
                t,
                file_id,
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &file_project_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    let detail = file_detail_from_conn(&conn, file_id)?;
    Ok(FileSummary {
        id: detail.id,
        name: detail.name,
        file_type: detail.file_type,
        updated_at_ms: detail.updated_at_ms,
    })
}

pub(crate) fn import_transcript_to_project_inner(
    st: &DbState,
    project_id: &str,
    src_path: &str,
    target_file_id: Option<&str>,
) -> Result<TranscriptImportOutcome, String> {
    if let Some(file_id) = target_file_id {
        let summary = import_transcript_to_file_inner(st, file_id, src_path, Some(project_id))?;
        let conn = open_db(st)?;
        let project = project_detail_from_conn(&conn, project_id)?;
        return Ok(TranscriptImportOutcome::Attached {
            project,
            file_id: summary.id,
        });
    }

    let stem = transcript_stem(src_path);
    let conn = open_db(st)?;
    let candidates = list_stem_attach_candidates(&conn, project_id, &stem)?;
    match candidates.len() {
        0 => {
            let name = stem.clone();
            let (project, file_id) = import_text_to_project_inner(st, project_id, &name, src_path)?;
            Ok(TranscriptImportOutcome::CreatedText { project, file_id })
        }
        1 => {
            drop(conn);
            let file_id = candidates[0].id.clone();
            let summary =
                import_transcript_to_file_inner(st, &file_id, src_path, Some(project_id))?;
            let conn = open_db(st)?;
            let project = project_detail_from_conn(&conn, project_id)?;
            Ok(TranscriptImportOutcome::Attached {
                project,
                file_id: summary.id,
            })
        }
        _ => Ok(TranscriptImportOutcome::NeedTarget {
            candidates,
            transcript_stem: stem,
        }),
    }
}

#[tauri::command]
pub async fn import_transcript_to_project(
    state: State<'_, DbState>,
    project_id: String,
    src_path: String,
    target_file_id: Option<String>,
) -> Result<TranscriptImportOutcome, String> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        import_transcript_to_project_inner(&st, &project_id, &src_path, target_file_id.as_deref())
    })
    .await
    .map_err(|e| format!("导入转录稿失败: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::DbState;
    use rusqlite::params;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    fn test_root(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi_file_import_{label}_{unique}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn test_state(label: &str) -> DbState {
        DbState::open_test_db(test_root(label))
    }

    fn seed_project_with_audio(st: &DbState, name: &str, audio_path: &str) -> (String, String) {
        seed_audio_file(st, name, "paired", audio_path, None, None)
    }

    fn seed_audio_file(
        st: &DbState,
        name: &str,
        file_type: &str,
        audio_path: &str,
        import_source_path: Option<&str>,
        import_content_sha256: Option<&str>,
    ) -> (String, String) {
        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        let t = now_ms();
        let conn = open_db(st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Project", t, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, import_source_path, \
             import_content_sha256, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &file_id,
                &project_id,
                name,
                file_type,
                audio_path,
                import_source_path,
                import_content_sha256,
                t,
                t,
            ],
        )
        .unwrap();
        (project_id, file_id)
    }

    fn file_import_provenance(
        conn: &rusqlite::Connection,
        file_id: &str,
    ) -> (Option<String>, Option<String>) {
        conn.query_row(
            "SELECT import_source_path, import_content_sha256 FROM files WHERE id = ?1",
            params![file_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap()
    }

    #[test]
    fn attach_preserves_audio_import_provenance() {
        use crate::project::import_duplicate::import_provenance_for_src;

        let st = test_state("attach_keep_provenance");
        let audio_path = test_root("attach_keep_provenance").join("interview.wav");
        fs::write(&audio_path, b"wav-bytes").unwrap();
        let audio_provenance = import_provenance_for_src(audio_path.to_str().unwrap()).unwrap();
        let (_, file_id) = seed_audio_file(
            &st,
            "采访",
            "paired",
            audio_path.to_str().unwrap(),
            Some(&audio_provenance.source_path),
            Some(&audio_provenance.content_sha256),
        );
        let srt = test_root("attach_keep_provenance").join("interview.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:03,000\nHello\n").unwrap();
        let srt_provenance = import_provenance_for_src(srt.to_str().unwrap()).unwrap();
        assert_ne!(audio_provenance.source_path, srt_provenance.source_path);

        import_transcript_to_file_inner(&st, &file_id, srt.to_str().unwrap(), None).unwrap();

        let conn = open_db(&st).unwrap();
        let (stored_path, stored_hash) = file_import_provenance(&conn, &file_id);
        assert_eq!(
            stored_path.as_deref(),
            Some(audio_provenance.source_path.as_str())
        );
        assert_eq!(
            stored_hash.as_deref(),
            Some(audio_provenance.content_sha256.as_str())
        );
    }

    #[test]
    fn audio_only_attach_promotes_to_paired() {
        let st = test_state("audio_only_attach");
        let audio_path = test_root("audio_only_attach").join("clip.wav");
        fs::write(&audio_path, b"wav").unwrap();
        let (_, file_id) = seed_audio_file(
            &st,
            "clip",
            "audio_only",
            audio_path.to_str().unwrap(),
            None,
            None,
        );
        let srt = test_root("audio_only_attach").join("clip.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:02,000\nHi\n").unwrap();

        import_transcript_to_file_inner(&st, &file_id, srt.to_str().unwrap(), None).unwrap();

        let detail = file_detail_from_conn(&open_db(&st).unwrap(), &file_id).unwrap();
        assert_eq!(detail.file_type, "paired");
        assert_eq!(
            detail.audio_path.as_deref(),
            Some(audio_path.to_str().unwrap())
        );
        assert_eq!(detail.segments.len(), 1);
    }

    #[test]
    fn attach_replace_keeps_audio_path() {
        let st = test_state("attach_keep_audio");
        let (project_id, file_id) = seed_project_with_audio(&st, "采访", "/tmp/interview.wav");
        let srt = test_root("attach_keep_audio").join("interview.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:03,000\nHello\n").unwrap();

        import_transcript_to_file_inner(&st, &file_id, srt.to_str().unwrap(), None).unwrap();

        let detail = file_detail_from_conn(&open_db(&st).unwrap(), &file_id).unwrap();
        assert_eq!(detail.file_type, "paired");
        assert_eq!(detail.audio_path.as_deref(), Some("/tmp/interview.wav"));
        assert_eq!(detail.segments.len(), 1);
        assert_eq!(detail.segments[0].text, "Hello");

        let outcome = import_transcript_to_project_inner(
            &st,
            &project_id,
            srt.to_str().unwrap(),
            Some(&file_id),
        )
        .unwrap();
        match outcome {
            TranscriptImportOutcome::Attached {
                file_id: attached, ..
            } => {
                assert_eq!(attached, file_id);
            }
            other => panic!("unexpected outcome: {other:?}"),
        }
    }

    #[test]
    fn stem_unique_match_attaches_without_target() {
        let st = test_state("stem_unique");
        let (project_id, file_id) = seed_project_with_audio(&st, "采访", "/tmp/a.wav");
        let srt = test_root("stem_unique").join("采访.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:02,000\nHi\n").unwrap();

        let outcome =
            import_transcript_to_project_inner(&st, &project_id, srt.to_str().unwrap(), None)
                .unwrap();
        match outcome {
            TranscriptImportOutcome::Attached {
                file_id: attached, ..
            } => {
                assert_eq!(attached, file_id);
            }
            other => panic!("unexpected outcome: {other:?}"),
        }
    }

    #[test]
    fn stem_zero_creates_text_file() {
        let st = test_state("stem_zero");
        let (project_id, _) = seed_project_with_audio(&st, "会议", "/tmp/meeting.wav");
        let srt = test_root("stem_zero").join("其他.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:02,000\nOther\n").unwrap();

        let outcome =
            import_transcript_to_project_inner(&st, &project_id, srt.to_str().unwrap(), None)
                .unwrap();
        match outcome {
            TranscriptImportOutcome::CreatedText { project, file_id } => {
                assert_eq!(project.files.len(), 2);
                let detail = file_detail_from_conn(&open_db(&st).unwrap(), &file_id).unwrap();
                assert_eq!(detail.file_type, "text");
                assert!(detail.audio_path.is_none());
                assert_eq!(detail.segments.len(), 1);
            }
            other => panic!("unexpected outcome: {other:?}"),
        }
    }

    #[test]
    fn stem_ambiguous_returns_need_target() {
        let st = test_state("stem_ambiguous");
        let project_id = Uuid::new_v4().to_string();
        let t = now_ms();
        let conn = open_db(&st).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![&project_id, "Project", t, t],
        )
        .unwrap();
        for (idx, path) in ["/tmp/a.wav", "/tmp/b.wav"].iter().enumerate() {
            conn.execute(
                "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    Uuid::new_v4().to_string(),
                    &project_id,
                    "采访",
                    "paired",
                    path,
                    t + idx as i64,
                    t + idx as i64,
                ],
            )
            .unwrap();
        }
        let srt = test_root("stem_ambiguous").join("采访.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:02,000\nX\n").unwrap();

        let outcome =
            import_transcript_to_project_inner(&st, &project_id, srt.to_str().unwrap(), None)
                .unwrap();
        match outcome {
            TranscriptImportOutcome::NeedTarget { candidates, .. } => {
                assert_eq!(candidates.len(), 2);
            }
            other => panic!("unexpected outcome: {other:?}"),
        }
    }

    #[test]
    fn attach_rejects_empty_transcript() {
        let st = test_state("attach_empty");
        let (project_id, file_id) = seed_project_with_audio(&st, "采访", "/tmp/interview.wav");
        let srt = test_root("attach_empty").join("empty.srt");
        fs::write(&srt, "\n\n").unwrap();

        let err = import_transcript_to_file_inner(&st, &file_id, srt.to_str().unwrap(), None)
            .unwrap_err();
        assert!(err.contains("未解析到任何语段"));

        let detail = file_detail_from_conn(&open_db(&st).unwrap(), &file_id).unwrap();
        assert!(detail.segments.is_empty());

        let _ = project_id;
    }

    #[test]
    fn attach_rejects_file_from_other_project() {
        let st = test_state("attach_wrong_project");
        let (project_a, file_a) = seed_project_with_audio(&st, "采访", "/tmp/a.wav");
        let (project_b, _) = seed_project_with_audio(&st, "会议", "/tmp/b.wav");
        let srt = test_root("attach_wrong_project").join("采访.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:02,000\nHi\n").unwrap();

        let err = import_transcript_to_project_inner(
            &st,
            &project_b,
            srt.to_str().unwrap(),
            Some(&file_a),
        )
        .unwrap_err();
        assert!(err.contains("不属于当前项目"));

        let detail = file_detail_from_conn(&open_db(&st).unwrap(), &file_a).unwrap();
        assert!(detail.segments.is_empty());

        let _ = project_a;
    }
}

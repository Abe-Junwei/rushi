use super::correction::{
    accept_correction_rule, learn_inferred_pairs_from_segment_save, list_glossary_learn_prompts,
    list_stable_correction_rules, upsert_explicit_correction_pairs, CorrectionExplicitPairDto,
    CorrectionLearnBaselineTextDto, CorrectionRuleRow, GlossaryLearnPromptRow,
    SaveSegmentsLearnOpts,
};
use super::edit_log_detail::{
    build_restore_from_edit_log_detail, build_save_segments_edit_detail_from_baseline,
    load_segment_text_by_uid,
};
use super::edit_log_snapshot;
use super::segment_media_sanitize::sanitize_segments_for_media;
use super::segment_uid::segment_uid_or_new;
use super::transcribe_timeout::probe_audio_duration_sec;
use super::types::SegmentDto;
use super::utils::{append_desktop_log_line, now_ms, open_db};
use crate::DbState;
use rusqlite::params;
use std::collections::HashMap;
use std::ops::Deref;
use std::path::Path;
use tauri::State;

fn file_audio_path(conn: &rusqlite::Connection, file_id: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT audio_path FROM files WHERE id = ?1",
        params![file_id],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

pub enum SegmentSaveEditLog {
    SaveSegments(SaveSegmentsLearnOpts),
    Custom { kind: &'static str, detail: String },
}

pub fn file_save_segments_inner(
    state: &DbState,
    file_id: &str,
    segments: &[SegmentDto],
    edit_log: SegmentSaveEditLog,
) -> Result<(), String> {
    let learn = match &edit_log {
        SegmentSaveEditLog::SaveSegments(learn) => learn.clone(),
        SegmentSaveEditLog::Custom { .. } => SaveSegmentsLearnOpts::default(),
    };
    let mut conn = open_db(state)?;
    let audio_path = file_audio_path(&conn, file_id)?;
    let duration_sec = audio_path
        .as_deref()
        .map(Path::new)
        .and_then(probe_audio_duration_sec);
    let (segments_owned, removed) =
        sanitize_segments_for_media(segments.to_vec(), duration_sec, true);
    if removed > 0 {
        append_desktop_log_line(
            state,
            &format!(
                "INFO save_segments filtered dominant spans removed={removed} file_id={file_id}"
            ),
        );
    }
    let segments = &segments_owned;
    let t = now_ms();
    let old_text_by_uid = load_segment_text_by_uid(&conn, file_id)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let project_id: String = tx
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let existing_uids: Vec<String> = tx
        .prepare("SELECT uid FROM segments WHERE file_id = ?1")
        .map_err(|e| e.to_string())?
        .query_map(params![file_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    for (slot, uid) in existing_uids.iter().enumerate() {
        let temp_idx = -((slot as i64) + 1);
        tx.execute(
            "UPDATE segments SET idx = ?1 WHERE file_id = ?2 AND uid = ?3",
            params![temp_idx, file_id, uid.as_str()],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut kept_uids: Vec<String> = Vec::with_capacity(segments.len());
    for s in segments {
        let uid = segment_uid_or_new(&s.uid);
        kept_uids.push(uid.clone());
        let low = if s.low_confidence { 1i64 } else { 0i64 };
        let detail = s.detail.as_deref().unwrap_or("");
        let kind = s.kind.as_deref().filter(|k| !k.trim().is_empty());
        let text_stage = if s.text_stage.trim().is_empty() {
            "auto_transcribe"
        } else {
            s.text_stage.as_str()
        };
        let finalize_via = s.finalize_via.as_deref().filter(|v| !v.trim().is_empty());
        let annotation = s.annotation.as_deref().unwrap_or("").trim();
        let updated = tx
            .execute(
                "UPDATE segments SET idx = ?1, start_sec = ?2, end_sec = ?3, text = ?4, \
                 confidence = ?5, low_confidence = ?6, detail = ?7, kind = ?8, \
                 text_stage = ?9, finalize_via = ?10, annotation = ?11 \
                 WHERE file_id = ?12 AND uid = ?13",
                params![
                    s.idx,
                    s.start_sec,
                    s.end_sec,
                    s.text.as_str(),
                    s.confidence,
                    low,
                    detail,
                    kind,
                    text_stage,
                    finalize_via,
                    annotation,
                    file_id,
                    uid.as_str(),
                ],
            )
            .map_err(|e| e.to_string())?;
        if updated == 0 {
            tx.execute(
                "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, confidence, low_confidence, detail, kind, text_stage, finalize_via, annotation) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    file_id,
                    uid.as_str(),
                    s.idx,
                    s.start_sec,
                    s.end_sec,
                    s.text.as_str(),
                    s.confidence,
                    low,
                    detail,
                    kind,
                    text_stage,
                    finalize_via,
                    annotation,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    if kept_uids.is_empty() {
        tx.execute("DELETE FROM segments WHERE file_id = ?1", params![file_id])
            .map_err(|e| e.to_string())?;
    } else {
        let mut stmt = tx
            .prepare("SELECT uid FROM segments WHERE file_id = ?1")
            .map_err(|e| e.to_string())?;
        let existing = stmt
            .query_map(params![file_id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for old_uid in existing {
            if !kept_uids.iter().any(|u| u == &old_uid) {
                tx.execute(
                    "DELETE FROM segments WHERE file_id = ?1 AND uid = ?2",
                    params![file_id, old_uid.as_str()],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }
    tx.execute(
        "UPDATE files SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, file_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, &project_id],
    )
    .map_err(|e| e.to_string())?;
    let (kind, detail) = match &edit_log {
        SegmentSaveEditLog::SaveSegments(learn_opts) => {
            let edit_detail = build_save_segments_edit_detail_from_baseline(
                &old_text_by_uid,
                file_id,
                segments,
                t,
                &learn_opts.explicit_pairs,
            )?;
            (
                "save_segments",
                serde_json::to_string(&edit_detail).map_err(|e| e.to_string())?,
            )
        }
        SegmentSaveEditLog::Custom { kind, detail } => (*kind, detail.clone()),
    };
    tx.execute(
        "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
        params![&project_id, t, kind, detail.as_str()],
    )
    .map_err(|e| e.to_string())?;
    let edit_log_id = tx.last_insert_rowid();
    edit_log_snapshot::insert_snapshot(&tx, edit_log_id, file_id, segments)?;
    tx.commit().map_err(|e| e.to_string())?;
    if !learn.explicit_pairs.is_empty() {
        if let Err(e) = upsert_explicit_correction_pairs(&conn, &learn.explicit_pairs, t) {
            append_desktop_log_line(
                state,
                &format!("WARN correction_memory_explicit_failed {e}"),
            );
        }
    }
    if learn.count_hits {
        let mut baseline_by_uid: HashMap<String, String> =
            learn.learn_baseline.into_iter().collect();
        if baseline_by_uid.is_empty() {
            for (uid, (_idx, text)) in &old_text_by_uid {
                baseline_by_uid.insert(uid.clone(), text.clone());
            }
        }
        if let Err(e) = learn_inferred_pairs_from_segment_save(&conn, &baseline_by_uid, segments, t)
        {
            append_desktop_log_line(
                state,
                &format!("WARN correction_memory_inferred_failed {e}"),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn file_save_segments(
    state: State<DbState>,
    file_id: String,
    segments: Vec<SegmentDto>,
    count_hits: Option<bool>,
    explicit_pairs: Option<Vec<CorrectionExplicitPairDto>>,
    learn_baseline_texts: Option<Vec<CorrectionLearnBaselineTextDto>>,
) -> Result<(), String> {
    let explicit_pairs = explicit_pairs
        .unwrap_or_default()
        .into_iter()
        .map(|p| (p.before_text, p.after_text))
        .collect();
    let learn_baseline = learn_baseline_texts
        .unwrap_or_default()
        .into_iter()
        .filter_map(|b| {
            let uid = b.uid.trim().to_string();
            if uid.is_empty() {
                None
            } else {
                Some((uid, b.text))
            }
        })
        .collect();
    file_save_segments_inner(
        state.deref(),
        &file_id,
        &segments,
        SegmentSaveEditLog::SaveSegments(SaveSegmentsLearnOpts {
            explicit_pairs,
            count_hits: count_hits.unwrap_or(true),
            learn_baseline,
        }),
    )
}

pub fn file_restore_segments_from_edit_log_inner(
    state: &DbState,
    file_id: &str,
    edit_log_id: i64,
) -> Result<(), String> {
    let conn = open_db(state)?;
    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM files WHERE id = ?1",
            params![file_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let log_project: String = conn
        .query_row(
            "SELECT project_id FROM edit_log WHERE id = ?1",
            params![edit_log_id],
            |r| r.get(0),
        )
        .map_err(|_| "编辑历史记录不存在".to_string())?;
    if log_project != project_id {
        return Err("编辑历史与当前文件不属于同一项目".into());
    }
    let segments = edit_log_snapshot::load_snapshot(&conn, edit_log_id, file_id)?;
    let t = now_ms();
    let restore_detail =
        build_restore_from_edit_log_detail(&conn, file_id, edit_log_id, &segments, t)?;
    let detail = serde_json::to_string(&restore_detail).map_err(|e| e.to_string())?;
    file_save_segments_inner(
        state,
        file_id,
        &segments,
        SegmentSaveEditLog::Custom {
            kind: "restore_from_edit_log",
            detail,
        },
    )
}

#[tauri::command]
pub fn file_restore_segments_from_edit_log(
    state: State<DbState>,
    file_id: String,
    edit_log_id: i64,
) -> Result<(), String> {
    file_restore_segments_from_edit_log_inner(state.deref(), &file_id, edit_log_id)
}

#[tauri::command]
pub fn correction_accept_rule(
    state: State<DbState>,
    before_text: String,
    after_text: String,
) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    accept_correction_rule(&conn, &before_text, &after_text, now_ms())
}

#[tauri::command]
pub fn correction_stable_rules_list(
    state: State<DbState>,
) -> Result<Vec<CorrectionRuleRow>, String> {
    let conn = open_db(state.deref())?;
    list_stable_correction_rules(&conn)
}

#[tauri::command]
pub fn correction_glossary_learn_prompts(
    state: State<DbState>,
) -> Result<Vec<GlossaryLearnPromptRow>, String> {
    let conn = open_db(state.deref())?;
    list_glossary_learn_prompts(&conn)
}

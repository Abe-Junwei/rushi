use super::super::correction::collect_correction_rule_hints;
use super::super::correction::SaveSegmentsLearnOpts;
use super::super::segment_cmd::{file_save_segments_inner, SegmentSaveEditLog};
use super::super::segment_media_sanitize::{
    sanitize_segments_for_media, trim_adjacent_segment_overlaps,
};
use super::super::transcribe_response::parse_transcribe_segments_from_json;
use super::super::transcribe_timeline::{TranscribeTimelineRecorder, STAGE_SAVE};
use super::super::utils::{append_desktop_log_line, file_detail_from_conn, now_ms, open_db};
use crate::DbState;
use std::fs;

pub(crate) async fn save_transcribe_segments(
    st: &DbState,
    file_id: &str,
    arr: &[serde_json::Value],
    warnings: &mut Vec<String>,
    audio_duration_sec: Option<f64>,
    mut timeline: Option<&mut TranscribeTimelineRecorder>,
) -> Result<(), String> {
    let conn = open_db(st)?;
    let file_detail = file_detail_from_conn(&conn, file_id)?;
    drop(conn);

    let mut segments = parse_transcribe_segments_from_json(arr)?;
    if segments.is_empty() {
        append_desktop_log_line(st, "INFO transcribe zero_segments_ok");
    }
    trim_adjacent_segment_overlaps(&mut segments);
    for (i, s) in segments.iter_mut().enumerate() {
        s.idx = i as i32;
    }
    let (segments, removed_dominant) =
        sanitize_segments_for_media(segments, audio_duration_sec, true);
    if removed_dominant > 0 {
        warnings.push(format!(
            "segments_dominant_span_filtered:{removed_dominant}"
        ));
        append_desktop_log_line(
            st,
            &format!("INFO transcribe filtered dominant spans removed={removed_dominant} file_id={file_id}"),
        );
    }
    match open_db(st) {
        Ok(conn) => {
            if let Ok(mut hint_warnings) = collect_correction_rule_hints(&conn, &segments) {
                warnings.append(&mut hint_warnings);
            } else {
                append_desktop_log_line(
                    st,
                    &format!("WARN transcribe correction hints collect failed file_id={file_id}"),
                );
            }
        }
        Err(e) => {
            append_desktop_log_line(
                st,
                &format!(
                    "WARN transcribe correction hints open_db failed file_id={file_id} err={e}"
                ),
            );
        }
    }
    if let Some(tl) = timeline.as_mut() {
        tl.begin_stage(STAGE_SAVE);
    }
    append_desktop_log_line(st, "INFO transcribe_stage=save");
    fs::create_dir_all(st.root.join("logs")).map_err(|e| e.to_string())?;
    let recovery_path = st
        .root
        .join("logs")
        .join(format!("transcribe_recovery_{file_id}.json"));
    let recovery_doc = serde_json::json!({
        "kind": "transcribe_segments_recovery",
        "file_id": file_id,
        "project_id": file_detail.project_id,
        "saved_at_ms": now_ms(),
        "segments": &segments,
    });
    fs::write(
        &recovery_path,
        serde_json::to_vec_pretty(&recovery_doc).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("无法写入转写恢复文件: {e}"))?;
    match file_save_segments_inner(
        st,
        file_id,
        &segments,
        SegmentSaveEditLog::SaveSegments(SaveSegmentsLearnOpts::default()),
    ) {
        Ok(()) => {
            let _ = fs::remove_file(&recovery_path);
        }
        Err(e) => {
            append_desktop_log_line(
                st,
                &format!(
                    "ERROR transcribe_save_failed recovery={}",
                    recovery_path.display()
                ),
            );
            let msg = format!("{e}（未落库语段已写入 {}）", recovery_path.display());
            if let Some(tl) = timeline.as_mut() {
                tl.fail_stage(STAGE_SAVE, "save_failed", &msg);
            }
            return Err(msg);
        }
    }
    Ok(())
}

use super::helpers::{apply_windowed_warning, record_transcribe_err, TranscribeInFlightGuard};
use super::save::save_transcribe_segments;
use super::super::local_transcribe_gate::assert_local_asr_ready_for_transcribe;
use super::super::stt_vocabulary::{
    vocabulary_support_warnings, SttVocabularyChannel, SttVocabularyPlan,
};
use super::super::transcribe::build_glossary_hotwords;
use super::super::transcribe_job::{
    get_transcribe_job_status, parse_transcribe_job_phase, post_transcribe_async_multipart,
};
use super::super::transcribe_response::merge_transcribe_warnings;
use super::super::transcribe_timeline::{
    store_active_timeline, take_active_timeline, TranscribeTimelineRecorder, STAGE_PREFLIGHT,
};
use super::super::transcribe_timeout::{
    local_transcribe_timeout_duration, long_audio_transcribe_hint, probe_audio_duration_sec,
};
use super::super::types::RunTranscribeOutcome;
use super::super::utils::{append_desktop_log_line, file_detail_from_conn, open_db};
use crate::DbState;
use std::path::Path;
use std::time::Duration;
use tauri::State;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeAsyncStartOutcome {
    pub job_id: String,
}

#[tauri::command]
pub async fn project_transcribe_async_start(
    state: State<'_, DbState>,
    file_id: String,
    asr_base_url: Option<String>,
) -> Result<TranscribeAsyncStartOutcome, String> {
    let st = state.inner().clone();
    let mut tl = TranscribeTimelineRecorder::new(&file_id, "local");
    tl.begin_stage(STAGE_PREFLIGHT);
    let conn = open_db(&st)?;
    let file_detail = file_detail_from_conn(&conn, &file_id)?;
    let hotwords_build = build_glossary_hotwords(&conn)?;
    let hotwords = SttVocabularyPlan::from_build(&hotwords_build).hotwords;
    drop(conn);
    let audio_path = match file_detail.audio_path.as_ref() {
        Some(p) => p,
        None => {
            record_transcribe_err(&mut tl, "该文件没有关联音频，无法转写".to_string());
            let _ = tl.persist(&st);
            return Err("该文件没有关联音频，无法转写".to_string());
        }
    };
    let audio_path = Path::new(audio_path);
    if !audio_path.is_file() {
        tl.fail_stage(STAGE_PREFLIGHT, "audio_missing", "项目音频文件缺失");
        let _ = tl.persist(&st);
        return Err("项目音频文件缺失".to_string());
    }
    let audio_duration_sec = probe_audio_duration_sec(audio_path);
    let base = asr_base_url
        .unwrap_or_else(|| "http://127.0.0.1:8741".to_string())
        .trim_end_matches('/')
        .to_string();
    crate::asr_sidecar::warm::inc_transcribe_in_flight();
    if let Err(e) = assert_local_asr_ready_for_transcribe(&st, &base).await {
        crate::asr_sidecar::warm::dec_transcribe_in_flight();
        record_transcribe_err(&mut tl, e.clone());
        let _ = tl.persist(&st);
        return Err(e);
    }
    let timeout = local_transcribe_timeout_duration(audio_duration_sec);
    append_desktop_log_line(&st, "INFO transcribe_async_start");
    let v = match post_transcribe_async_multipart(
        &st,
        &base,
        audio_path,
        hotwords,
        timeout,
        Some(&mut tl),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            crate::asr_sidecar::warm::dec_transcribe_in_flight();
            let _ = tl.persist(&st);
            return Err(e);
        }
    };
    let job_id = match v.get("job_id").and_then(|x| x.as_str()) {
        Some(id) => id,
        None => {
            crate::asr_sidecar::warm::dec_transcribe_in_flight();
            record_transcribe_err(&mut tl, "侧车未返回 job_id".to_string());
            let _ = tl.persist(&st);
            return Err("侧车未返回 job_id".to_string());
        }
    };
    tl.set_job_id(job_id);
    store_active_timeline(job_id, tl);
    append_desktop_log_line(&st, &format!("INFO transcribe_async job_id={job_id}"));
    Ok(TranscribeAsyncStartOutcome {
        job_id: job_id.to_string(),
    })
}

#[tauri::command]
pub async fn project_transcribe_async_finalize(
    state: State<'_, DbState>,
    file_id: String,
    job_id: String,
    asr_base_url: Option<String>,
) -> Result<RunTranscribeOutcome, String> {
    let st = state.inner().clone();
    let _in_flight = TranscribeInFlightGuard;
    crate::asr_sidecar::supervisor::record_activity_global();
    let conn = open_db(&st)?;
    let hotwords_build = build_glossary_hotwords(&conn)?;
    let hotwords_truncated = hotwords_build.preview.truncated;
    let vocabulary = SttVocabularyPlan::from_build(&hotwords_build);
    let vocabulary_pre_warnings = vocabulary_support_warnings(
        SttVocabularyChannel::LocalFunasrMultipart,
        &vocabulary,
        hotwords_truncated,
    );
    drop(conn);

    let base = asr_base_url
        .unwrap_or_else(|| "http://127.0.0.1:8741".to_string())
        .trim_end_matches('/')
        .to_string();
    let status = get_transcribe_job_status(&st, &base, &job_id, Duration::from_secs(30)).await?;
    let phase = parse_transcribe_job_phase(&status);
    let mut tl = take_active_timeline(&job_id)
        .unwrap_or_else(|| TranscribeTimelineRecorder::new(&file_id, "local"));
    tl.set_job_id(&job_id);
    if phase != "done" {
        let msg = if phase == "cancelled" {
            "转写已取消".to_string()
        } else if phase == "unknown" {
            "转写任务不存在（侧车可能已重启）".to_string()
        } else {
            status
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .or_else(|| status.get("message").and_then(|m| m.as_str()))
                .unwrap_or("转写未完成")
                .to_string()
        };
        record_transcribe_err(&mut tl, msg.clone());
        let _ = tl.persist(&st);
        return Err(msg);
    }
    if let (Some(i), Some(n)) = (
        status.get("window_index").and_then(|x| x.as_u64()),
        status.get("window_count").and_then(|x| x.as_u64()),
    ) {
        tl.set_window_progress(i as u32, n as u32);
    }

    let audio_path = {
        let conn = open_db(&st)?;
        let file_detail = file_detail_from_conn(&conn, &file_id)?;
        file_detail
            .audio_path
            .ok_or("该文件没有关联音频，无法转写")?
    };
    let audio_duration_sec = probe_audio_duration_sec(Path::new(&audio_path));

    let engine = status
        .get("engine")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let base_warnings: Vec<String> = status
        .get("warnings")
        .and_then(|w| w.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(std::string::ToString::to_string))
                .collect()
        })
        .unwrap_or_default();
    let segmentation_mode = status.get("segmentation_mode").and_then(|x| x.as_str());
    let mut warnings = merge_transcribe_warnings(
        base_warnings,
        vocabulary_pre_warnings,
        hotwords_truncated,
        long_audio_transcribe_hint(audio_duration_sec),
        segmentation_mode,
    );
    if segmentation_mode == Some("transcribe_windowed") {
        append_desktop_log_line(&st, "INFO transcribe_windowed_path");
    }

    apply_windowed_warning(&mut tl, &warnings);
    let arr = status
        .get("segments")
        .and_then(|s| s.as_array())
        .ok_or_else(|| "响应缺少 segments 数组".to_string())?;
    save_transcribe_segments(
        &st,
        &file_id,
        arr,
        &mut warnings,
        audio_duration_sec,
        Some(&mut tl),
    )
    .await?;
    let conn = open_db(&st)?;
    let detail = file_detail_from_conn(&conn, &file_id)?;
    tl.finish_success(&warnings);
    let snap = tl.snapshot();
    let _ = tl.persist(&st);
    Ok(RunTranscribeOutcome {
        detail,
        engine,
        warnings,
        transcribe_timeline: Some(snap),
    })
}

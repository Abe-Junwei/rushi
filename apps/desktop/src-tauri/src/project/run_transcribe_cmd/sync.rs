use super::super::local_transcribe_gate::assert_local_asr_ready_for_transcribe;
use super::super::online_segment_normalize::normalize_online_transcribe_json;
use super::super::stt_vocabulary::{
    channel_for_online, vocabulary_support_warnings, SttVocabularyChannel, SttVocabularyPlan,
};
use super::super::transcribe::{
    build_glossary_hotwords, post_transcribe_multipart, TranscribeHttpOptions,
    TranscribeRequestAuth,
};
use super::super::transcribe_cancel_cmd::{
    run_transcribe_abortable, TranscribeCancelState, TRANSCRIBE_CANCELLED_MESSAGE,
};
use super::super::transcribe_errors::describe_transcribe_payload_error;
use super::super::transcribe_response::merge_transcribe_warnings;
use super::super::transcribe_timeline::{
    fail_and_persist_active_timeline, load_last_timeline, update_active_timeline_progress,
    TranscribeTimelineRecorder, STAGE_PREFLIGHT,
};
use super::super::transcribe_timeout::{
    local_transcribe_timeout_duration, long_audio_transcribe_hint, probe_audio_duration_sec,
};
use super::super::types::RunTranscribeOutcome;
use super::super::utils::{append_desktop_log_line, file_detail_from_conn, open_db};
use super::helpers::{apply_windowed_warning, record_transcribe_err};
use super::online_fetch::fetch_online_transcribe_json;
use super::save::save_transcribe_segments;
use crate::online_stt_bridge::OnlineTranscribeBridge;
use crate::DbState;
use std::path::Path;
use tauri::State;

#[tauri::command]
pub async fn project_run_transcribe(
    state: State<'_, DbState>,
    cancel_state: State<'_, TranscribeCancelState>,
    file_id: String,
    asr_base_url: Option<String>,
    online: Option<OnlineTranscribeBridge>,
    request_id: Option<String>,
) -> Result<RunTranscribeOutcome, String> {
    let st = state.inner().clone();
    crate::asr_sidecar::warm::inc_transcribe_in_flight();
    let source = if online.is_some() { "online" } else { "local" };
    let mut tl = TranscribeTimelineRecorder::new(&file_id, source);
    if let Some(ref id) = request_id {
        let trimmed = id.trim();
        if !trimmed.is_empty() {
            tl.set_job_id(trimmed);
        }
    }
    let out = match project_run_transcribe_inner(
        st.clone(),
        cancel_state.inner(),
        file_id,
        asr_base_url,
        online,
        request_id,
        &mut tl,
    )
    .await
    {
        Ok(mut out) => {
            tl.finish_success(&out.warnings);
            let snap = tl.snapshot();
            let _ = tl.persist(&st);
            out.transcribe_timeline = Some(snap);
            Ok(out)
        }
        Err(e) => {
            if tl.snapshot().outcome != "failed" && tl.snapshot().outcome != "cancelled" {
                record_transcribe_err(&mut tl, e.clone());
            }
            let _ = tl.persist(&st);
            Err(e)
        }
    };
    crate::asr_sidecar::warm::dec_transcribe_in_flight();
    out
}

#[tauri::command]
pub fn get_last_transcribe_timeline(
    state: State<'_, DbState>,
) -> Option<super::super::transcribe_timeline::TranscribeTimelineSnapshot> {
    load_last_timeline(&state.inner().root)
}

#[tauri::command]
pub fn record_transcribe_timeline_poll_progress(
    state: State<'_, DbState>,
    job_id: String,
    window_index: u32,
    window_count: u32,
) -> Result<(), String> {
    crate::asr_sidecar::supervisor::record_activity_global();
    update_active_timeline_progress(state.inner(), &job_id, window_index, window_count)
}

#[tauri::command]
pub fn record_transcribe_timeline_poll_failure(
    state: State<'_, DbState>,
    job_id: String,
    error_message: String,
) -> Result<(), String> {
    fail_and_persist_active_timeline(state.inner(), &job_id, &error_message)
}

async fn project_run_transcribe_inner(
    st: DbState,
    cancel_state: &TranscribeCancelState,
    file_id: String,
    asr_base_url: Option<String>,
    online: Option<OnlineTranscribeBridge>,
    request_id: Option<String>,
    tl: &mut TranscribeTimelineRecorder,
) -> Result<RunTranscribeOutcome, String> {
    tl.begin_stage(STAGE_PREFLIGHT);
    let conn = open_db(&st)?;
    let file_detail = file_detail_from_conn(&conn, &file_id)?;
    let hotwords_build = build_glossary_hotwords(&conn)?;
    let hotwords_truncated = hotwords_build.preview.truncated;
    let vocabulary = SttVocabularyPlan::from_build(&hotwords_build);
    let hotwords = vocabulary.hotwords.clone();
    drop(conn);
    let audio_path = file_detail
        .audio_path
        .as_ref()
        .ok_or_else(|| record_transcribe_err(tl, "该文件没有关联音频，无法转写".to_string()))?;
    let audio_path = Path::new(audio_path);
    if !audio_path.is_file() {
        append_desktop_log_line(&st, "ERROR transcribe audio_missing");
        tl.fail_stage(STAGE_PREFLIGHT, "audio_missing", "项目音频文件缺失");
        return Err("项目音频文件缺失".to_string());
    }
    let audio_duration_sec = probe_audio_duration_sec(audio_path);
    append_desktop_log_line(&st, "INFO transcribe_stage=preflight");

    let (mut v, vocabulary_pre_warnings) = if let Some(ref o) = online {
        let use_multipart = !matches!(
            o.native_adapter.as_deref(),
            Some("openaiAudio" | "assemblyai" | "dashscopeAsr" | "deepgramListen" | "xunfeiSpeedAsr")
        );
        let channel = channel_for_online(o.native_adapter.as_deref(), use_multipart);
        let vocabulary_pre_warnings =
            vocabulary_support_warnings(channel, &vocabulary, hotwords_truncated);
        let cancel_poll = request_id
            .as_deref()
            .filter(|id| !id.trim().is_empty())
            .map(|id| (cancel_state, id.trim()));
        let st_ref = &st;
        let v = run_transcribe_abortable(
            cancel_state,
            request_id.as_deref(),
            fetch_online_transcribe_json(
                st_ref,
                tl,
                audio_path,
                &hotwords,
                &vocabulary,
                o,
                cancel_poll,
            ),
        )
        .await
        .map_err(|e| {
            if e == TRANSCRIBE_CANCELLED_MESSAGE {
                append_desktop_log_line(&st, "INFO transcribe_cancelled");
                tl.finish_cancelled();
            }
            e
        })?;
        (v, vocabulary_pre_warnings)
    } else {
        crate::asr_sidecar::supervisor::record_activity_global();
        let vocabulary_pre_warnings = vocabulary_support_warnings(
            SttVocabularyChannel::LocalFunasrMultipart,
            &vocabulary,
            hotwords_truncated,
        );
        let base = asr_base_url
            .unwrap_or_else(|| "http://127.0.0.1:8741".to_string())
            .trim_end_matches('/')
            .to_string();
        assert_local_asr_ready_for_transcribe(&st, &base)
            .await
            .map_err(|e| record_transcribe_err(tl, e))?;
        let url = format!("{base}/v1/transcribe");
        let timeout = local_transcribe_timeout_duration(audio_duration_sec);
        append_desktop_log_line(
            &st,
            &format!(
                "INFO transcribe local audio_duration_sec={audio_duration_sec:?} timeout_s={}",
                timeout.as_secs()
            ),
        );
        let v = post_transcribe_multipart(
            &st,
            &url,
            audio_path,
            hotwords,
            TranscribeHttpOptions {
                auth: TranscribeRequestAuth::default(),
                timeout,
                cancel: None,
            },
            Some(tl),
        )
        .await?;
        (v, vocabulary_pre_warnings)
    };
    if online.is_some() {
        let engine = v
            .get("engine")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        if let Some(refined_count) =
            super::super::online_segment_normalize::refine_online_transcribe_segments(
                &mut v, &engine,
            )
        {
            append_desktop_log_line(
                &st,
                &format!("INFO transcribe online_segment_refine segments={refined_count}"),
            );
        }
        let extra = normalize_online_transcribe_json(
            &mut v,
            audio_duration_sec,
            &super::super::online_segment_normalize::OnlineSegmentNormalizeOptions::default(),
        );
        if !extra.is_empty() {
            append_desktop_log_line(
                &st,
                &format!("INFO transcribe online_segment_normalize {:?}", extra),
            );
            if let Some(warr) = v.get_mut("warnings").and_then(|w| w.as_array_mut()) {
                for w in extra {
                    warr.push(serde_json::Value::String(w));
                }
            } else {
                v["warnings"] = serde_json::json!(extra);
            }
        }
    }
    append_desktop_log_line(&st, "INFO transcribe_stage=parse");
    if let Some(err) = v.get("error").filter(|e| !e.is_null()) {
        let msg = err
            .get("message")
            .and_then(|m| m.as_str())
            .map(String::from)
            .or_else(|| err.as_str().map(String::from))
            .unwrap_or_else(|| err.to_string());
        let code = err
            .get("code")
            .and_then(|c| c.as_str())
            .unwrap_or("unknown");
        append_desktop_log_line(
            &st,
            &format!(
                "ERROR transcribe asr_payload code={code} {}",
                crate::utils::redact_secrets_for_log(&msg)
            ),
        );
        return Err(record_transcribe_err(
            tl,
            describe_transcribe_payload_error(code, &msg),
        ));
    }

    let engine = v
        .get("engine")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let base_warnings: Vec<String> = v
        .get("warnings")
        .and_then(|w| w.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(std::string::ToString::to_string))
                .collect()
        })
        .unwrap_or_default();
    let segmentation_mode = v.get("segmentation_mode").and_then(|x| x.as_str());
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
    apply_windowed_warning(tl, &warnings);
    for w in warnings.iter() {
        if w.starts_with("transcribe_windowed:") {
            append_desktop_log_line(&st, &format!("INFO transcribe {w}"));
            break;
        }
    }

    let arr = v
        .get("segments")
        .and_then(|s| s.as_array())
        .ok_or_else(|| record_transcribe_err(tl, "响应缺少 segments 数组".to_string()))?;
    save_transcribe_segments(
        &st,
        &file_id,
        arr,
        &mut warnings,
        audio_duration_sec,
        Some(tl),
    )
    .await?;
    let conn = open_db(&st)?;
    let detail = file_detail_from_conn(&conn, &file_id)?;
    Ok(RunTranscribeOutcome {
        detail,
        engine,
        warnings,
        transcribe_timeline: None,
    })
}

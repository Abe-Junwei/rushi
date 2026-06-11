use super::correction::collect_correction_rule_hints;
use super::correction::SaveSegmentsLearnOpts;
use super::local_transcribe_gate::assert_local_asr_ready_for_transcribe;
use super::online_segment_normalize::normalize_online_transcribe_json;
use super::segment_cmd::{file_save_segments_inner, SegmentSaveEditLog};
use super::segment_media_sanitize::{sanitize_segments_for_media, trim_adjacent_segment_overlaps};
use super::stt_vocabulary::{
    channel_for_online, vocabulary_support_warnings, SttVocabularyChannel, SttVocabularyPlan,
};
use super::transcribe::{
    build_glossary_hotwords, post_transcribe_multipart, TranscribeRequestAuth,
};
use super::transcribe_errors::describe_transcribe_payload_error;
use super::transcribe_job::{
    get_transcribe_job_status, parse_transcribe_job_phase, post_transcribe_async_multipart,
};
use super::transcribe_native_online::{transcribe_assemblyai_native, transcribe_openai_native};
use super::transcribe_response::{merge_transcribe_warnings, parse_transcribe_segments_from_json};
use super::transcribe_timeline::{
    fail_and_persist_active_timeline, infer_failed_stage_from_message, infer_transcribe_error_code,
    load_last_timeline, store_active_timeline, take_active_timeline,
    update_active_timeline_progress, TranscribeTimelineRecorder, STAGE_PREFLIGHT, STAGE_SAVE,
    STAGE_TRANSCRIBE,
};
use super::transcribe_timeout::{
    local_transcribe_timeout_duration, long_audio_transcribe_hint, probe_audio_duration_sec,
};
use super::types::RunTranscribeOutcome;
use super::utils::{append_desktop_log_line, file_detail_from_conn, now_ms, open_db};
use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, OnlineTranscribeBridge};
use crate::DbState;
use std::fs;
use std::path::Path;
use std::time::Duration;
use tauri::State;

struct TranscribeInFlightGuard;

impl Drop for TranscribeInFlightGuard {
    fn drop(&mut self) {
        crate::asr_sidecar::warm::dec_transcribe_in_flight();
    }
}

fn record_transcribe_err(tl: &mut TranscribeTimelineRecorder, err: String) -> String {
    if tl.snapshot().outcome != "failed" {
        let stage = infer_failed_stage_from_message(&err);
        let code = infer_transcribe_error_code(&err);
        tl.fail_stage(stage, code, &err);
    }
    err
}

fn apply_windowed_warning(tl: &mut TranscribeTimelineRecorder, warnings: &[String]) {
    for w in warnings {
        if let Some(rest) = w.strip_prefix("transcribe_windowed:windows=") {
            if let Ok(total) = rest.parse::<u32>() {
                tl.set_window_count_only(total);
            }
        }
    }
}

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

#[tauri::command]
pub async fn project_run_transcribe(
    state: State<'_, DbState>,
    file_id: String,
    asr_base_url: Option<String>,
    online: Option<OnlineTranscribeBridge>,
) -> Result<RunTranscribeOutcome, String> {
    let st = state.inner().clone();
    crate::asr_sidecar::warm::inc_transcribe_in_flight();
    let source = if online.is_some() { "online" } else { "local" };
    let mut tl = TranscribeTimelineRecorder::new(&file_id, source);
    let out = match project_run_transcribe_inner(st.clone(), file_id, asr_base_url, online, &mut tl)
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
            if tl.snapshot().outcome != "failed" {
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
) -> Option<super::transcribe_timeline::TranscribeTimelineSnapshot> {
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
    file_id: String,
    asr_base_url: Option<String>,
    online: Option<OnlineTranscribeBridge>,
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
        let timeout_s = o.timeout_sec.unwrap_or(600).clamp(30, 600);
        let dur = Duration::from_secs(timeout_s);
        let use_multipart = !matches!(
            o.native_adapter.as_deref(),
            Some("openaiAudio" | "assemblyai" | "dashscopeAsr" | "deepgramListen")
        );
        let channel = channel_for_online(o.native_adapter.as_deref(), use_multipart);
        let vocabulary_pre_warnings =
            vocabulary_support_warnings(channel, &vocabulary, hotwords_truncated);
        let v = match o.native_adapter.as_deref() {
            Some("openaiAudio") => {
                tl.begin_stage(STAGE_TRANSCRIBE);
                transcribe_openai_native(&st, audio_path, &vocabulary, o, dur)
                    .await
                    .map_err(|e| record_transcribe_err(tl, e))?
            }
            Some("assemblyai") => {
                tl.begin_stage(STAGE_TRANSCRIBE);
                transcribe_assemblyai_native(&st, audio_path, &vocabulary, o, dur)
                    .await
                    .map_err(|e| record_transcribe_err(tl, e))?
            }
            Some(adapter @ ("dashscopeAsr" | "deepgramListen")) => {
                tl.begin_stage(STAGE_TRANSCRIBE);
                let client = crate::stt_native::http_client();
                let log = |line: &str| append_desktop_log_line(&st, line);
                crate::stt_native::dispatch_native(
                    adapter,
                    client,
                    audio_path,
                    o,
                    &vocabulary,
                    dur,
                    &log,
                )
                .await
                .map_err(|e| record_transcribe_err(tl, e))?
            }
            _ => {
                let url = o.transcribe_url.trim();
                if url.is_empty() {
                    return Err(record_transcribe_err(tl, "在线转写 URL 为空".to_string()));
                }
                if !is_allowed_stt_transcribe_url(url) {
                    return Err(record_transcribe_err(
                        tl,
                        "在线转写 URL 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1"
                            .to_string(),
                    ));
                }
                let auth = o.authorization.as_deref();
                let app_k = o.app_key.as_deref().and_then(|s| {
                    let t = s.trim();
                    if t.is_empty() {
                        None
                    } else {
                        Some(t)
                    }
                });
                append_desktop_log_line(&st, "INFO transcribe online_multipart");
                post_transcribe_multipart(
                    &st,
                    url,
                    audio_path,
                    hotwords.clone(),
                    TranscribeRequestAuth {
                        authorization: auth,
                        app_key: app_k,
                    },
                    dur,
                    Some(tl),
                )
                .await?
            }
        };
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
            TranscribeRequestAuth::default(),
            timeout,
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
            super::online_segment_normalize::refine_online_transcribe_segments(&mut v, &engine)
        {
            append_desktop_log_line(
                &st,
                &format!("INFO transcribe online_segment_refine segments={refined_count}"),
            );
        }
        let extra = normalize_online_transcribe_json(
            &mut v,
            audio_duration_sec,
            &super::online_segment_normalize::OnlineSegmentNormalizeOptions::default(),
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

async fn save_transcribe_segments(
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

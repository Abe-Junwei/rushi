use super::correction::collect_correction_rule_hints;
use super::local_transcribe_gate::assert_local_asr_ready_for_transcribe;
use super::segment_cmd::file_save_segments_inner;
use super::segment_media_sanitize::{sanitize_segments_for_media, trim_adjacent_segment_overlaps};
use super::stt_vocabulary::{
    channel_for_online, vocabulary_support_warnings, SttVocabularyChannel, SttVocabularyPlan,
};
use super::transcribe::{build_glossary_hotwords, post_transcribe_multipart};
use super::transcribe_errors::describe_transcribe_payload_error;
use super::transcribe_job::{
    get_transcribe_job_status, post_transcribe_async_multipart, parse_transcribe_job_phase,
};
use super::transcribe_native_online::{transcribe_assemblyai_native, transcribe_openai_native};
use super::transcribe_response::{merge_transcribe_warnings, parse_transcribe_segments_from_json};
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
    let conn = open_db(&st)?;
    let file_detail = file_detail_from_conn(&conn, &file_id)?;
    let hotwords_build = build_glossary_hotwords(&conn)?;
    let hotwords = SttVocabularyPlan::from_build(&hotwords_build).hotwords;
    drop(conn);
    let audio_path = file_detail
        .audio_path
        .as_ref()
        .ok_or("该文件没有关联音频，无法转写")?;
    let audio_path = Path::new(audio_path);
    if !audio_path.is_file() {
        return Err("项目音频文件缺失".to_string());
    }
    let audio_duration_sec = probe_audio_duration_sec(audio_path);
    let base = asr_base_url
        .unwrap_or_else(|| "http://127.0.0.1:8741".to_string())
        .trim_end_matches('/')
        .to_string();
    assert_local_asr_ready_for_transcribe(&st, &base).await?;
    let timeout = local_transcribe_timeout_duration(audio_duration_sec);
    append_desktop_log_line(&st, "INFO transcribe_async_start");
    let v = post_transcribe_async_multipart(&st, &base, audio_path, hotwords, timeout).await?;
    let job_id = v
        .get("job_id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "侧车未返回 job_id".to_string())?
        .to_string();
    append_desktop_log_line(
        &st,
        &format!("INFO transcribe_async job_id={job_id}"),
    );
    Ok(TranscribeAsyncStartOutcome { job_id })
}

#[tauri::command]
pub async fn project_transcribe_async_finalize(
    state: State<'_, DbState>,
    file_id: String,
    job_id: String,
    asr_base_url: Option<String>,
) -> Result<RunTranscribeOutcome, String> {
    let st = state.inner().clone();
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
    let status = get_transcribe_job_status(
        &st,
        &base,
        &job_id,
        Duration::from_secs(30),
    )
    .await?;
    let phase = parse_transcribe_job_phase(&status);
    if phase != "done" {
        if phase == "cancelled" {
            return Err("转写已取消".to_string());
        }
        if phase == "unknown" {
            return Err("转写任务不存在（侧车可能已重启）".to_string());
        }
        let msg = status
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .or_else(|| status.get("message").and_then(|m| m.as_str()))
            .unwrap_or("转写未完成");
        return Err(msg.to_string());
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

    let arr = status
        .get("segments")
        .and_then(|s| s.as_array())
        .ok_or_else(|| "响应缺少 segments 数组".to_string())?;
    save_transcribe_segments(&st, &file_id, arr, &mut warnings, audio_duration_sec).await?;
    let conn = open_db(&st)?;
    let detail = file_detail_from_conn(&conn, &file_id)?;
    Ok(RunTranscribeOutcome {
        detail,
        engine,
        warnings,
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
    project_run_transcribe_inner(st, file_id, asr_base_url, online).await
}

async fn project_run_transcribe_inner(
    st: DbState,
    file_id: String,
    asr_base_url: Option<String>,
    online: Option<OnlineTranscribeBridge>,
) -> Result<RunTranscribeOutcome, String> {
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
        .ok_or("该文件没有关联音频，无法转写")?;
    let audio_path = Path::new(audio_path);
    if !audio_path.is_file() {
        append_desktop_log_line(&st, "ERROR transcribe audio_missing");
        return Err("项目音频文件缺失".to_string());
    }
    let audio_duration_sec = probe_audio_duration_sec(audio_path);
    append_desktop_log_line(&st, "INFO transcribe_stage=preflight");

    let (v, vocabulary_pre_warnings) = if let Some(ref o) = online {
        let timeout_s = o.timeout_sec.unwrap_or(600).clamp(30, 600);
        let dur = Duration::from_secs(timeout_s);
        let use_multipart = !matches!(
            o.native_adapter.as_deref(),
            Some(
                "openaiAudio"
                    | "assemblyai"
                    | "baiduSpeech"
                    | "aliyunNls"
                    | "deepgramListen"
                    | "tencentAsr"
                    | "azureConversationV1"
                    | "googleSpeechV1"
                    | "iflytekIatWs"
                    | "huaweiSisShortAudio"
                    | "aispeechLasrSentenceV2"
                    | "volcengineBigmodelNostreamWs"
            )
        );
        let channel = channel_for_online(o.native_adapter.as_deref(), use_multipart);
        let vocabulary_pre_warnings =
            vocabulary_support_warnings(channel, &vocabulary, hotwords_truncated);
        let v = match o.native_adapter.as_deref() {
            Some("openaiAudio") => {
                transcribe_openai_native(&st, audio_path, &vocabulary, o, dur).await?
            }
            Some("assemblyai") => {
                transcribe_assemblyai_native(&st, audio_path, &vocabulary, o, dur).await?
            }
            Some(
                adapter @ ("baiduSpeech"
                | "aliyunNls"
                | "deepgramListen"
                | "tencentAsr"
                | "azureConversationV1"
                | "googleSpeechV1"
                | "iflytekIatWs"
                | "huaweiSisShortAudio"
                | "aispeechLasrSentenceV2"
                | "volcengineBigmodelNostreamWs"),
            ) => {
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
                .await?
            }
            _ => {
                let url = o.transcribe_url.trim();
                if url.is_empty() {
                    return Err("在线转写 URL 为空".to_string());
                }
                if !is_allowed_stt_transcribe_url(url) {
                    return Err(
                        "在线转写 URL 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1"
                            .to_string(),
                    );
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
                post_transcribe_multipart(&st, url, audio_path, hotwords.clone(), auth, app_k, dur)
                    .await?
            }
        };
        (v, vocabulary_pre_warnings)
    } else {
        let vocabulary_pre_warnings = vocabulary_support_warnings(
            SttVocabularyChannel::LocalFunasrMultipart,
            &vocabulary,
            hotwords_truncated,
        );
        let base = asr_base_url
            .unwrap_or_else(|| "http://127.0.0.1:8741".to_string())
            .trim_end_matches('/')
            .to_string();
        assert_local_asr_ready_for_transcribe(&st, &base).await?;
        let url = format!("{base}/v1/transcribe");
        let timeout = local_transcribe_timeout_duration(audio_duration_sec);
        append_desktop_log_line(
            &st,
            &format!(
                "INFO transcribe local audio_duration_sec={audio_duration_sec:?} timeout_s={}",
                timeout.as_secs()
            ),
        );
        let v =
            post_transcribe_multipart(&st, &url, audio_path, hotwords, None, None, timeout).await?;
        (v, vocabulary_pre_warnings)
    };
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
        return Err(describe_transcribe_payload_error(code, &msg));
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
    for w in warnings.iter() {
        if w.starts_with("transcribe_windowed:") {
            append_desktop_log_line(&st, &format!("INFO transcribe {w}"));
            break;
        }
    }

    let arr = v
        .get("segments")
        .and_then(|s| s.as_array())
        .ok_or_else(|| "响应缺少 segments 数组".to_string())?;
    save_transcribe_segments(&st, &file_id, arr, &mut warnings, audio_duration_sec).await?;
    let conn = open_db(&st)?;
    let detail = file_detail_from_conn(&conn, &file_id)?;
    Ok(RunTranscribeOutcome {
        detail,
        engine,
        warnings,
    })
}

async fn save_transcribe_segments(
    st: &DbState,
    file_id: &str,
    arr: &[serde_json::Value],
    warnings: &mut Vec<String>,
    audio_duration_sec: Option<f64>,
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
    if let Ok(conn) = open_db(st) {
        if let Ok(mut hint_warnings) = collect_correction_rule_hints(&conn, &segments) {
            warnings.append(&mut hint_warnings);
        }
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
    match file_save_segments_inner(st, file_id, &segments) {
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
            return Err(format!(
                "{e}（未落库语段已写入 {}）",
                recovery_path.display()
            ));
        }
    }
    Ok(())
}
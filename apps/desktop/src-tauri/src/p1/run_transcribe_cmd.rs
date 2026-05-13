use super::correction::collect_correction_rule_hints;
use super::project_cmd::project_save_segments_inner;
use super::transcribe::{
    glossary_hotwords_joined, post_transcribe_multipart, transcribe_assemblyai_native,
    transcribe_openai_native,
};
use super::types::{RunTranscribeOutcome, SegmentDto};
use super::utils::{append_desktop_log_line, now_ms, open_db, project_detail_from_conn};
use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, P1OnlineTranscribeBridge};
use crate::DbState;
use std::fs;
use std::ops::Deref;
use std::path::Path;
use std::time::Duration;
use tauri::State;

#[tauri::command]
pub fn p1_project_save_segments(
    state: State<DbState>,
    project_id: String,
    segments: Vec<SegmentDto>,
) -> Result<(), String> {
    project_save_segments_inner(state.deref(), &project_id, &segments)
}

#[tauri::command]
pub async fn p1_project_run_transcribe(
    state: State<'_, DbState>,
    project_id: String,
    asr_base_url: Option<String>,
    online: Option<P1OnlineTranscribeBridge>,
) -> Result<RunTranscribeOutcome, String> {
    let st = state.inner().clone();
    p1_project_run_transcribe_inner(st, project_id, asr_base_url, online).await
}

async fn p1_project_run_transcribe_inner(
    st: DbState,
    project_id: String,
    asr_base_url: Option<String>,
    online: Option<P1OnlineTranscribeBridge>,
) -> Result<RunTranscribeOutcome, String> {
    let conn = open_db(&st)?;
    let detail = project_detail_from_conn(&conn, &project_id)?;
    let hotwords = glossary_hotwords_joined(&conn)?;
    drop(conn);
    let audio_path = Path::new(&detail.audio_storage_path);
    if !audio_path.is_file() {
        append_desktop_log_line(&st, "ERROR transcribe audio_missing");
        return Err("项目音频文件缺失".to_string());
    }

    let v: serde_json::Value = if let Some(ref o) = online {
        let timeout_s = o.timeout_sec.unwrap_or(600).clamp(30, 600);
        let dur = Duration::from_secs(timeout_s);
        match o.native_adapter.as_deref() {
            Some("openaiAudio") => transcribe_openai_native(&st, audio_path, &hotwords, o, dur).await?,
            Some("assemblyai") => transcribe_assemblyai_native(&st, audio_path, o, dur).await?,
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
                crate::stt_native::dispatch_native(adapter, client, audio_path, o, dur, &log).await?
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
                post_transcribe_multipart(&st, url, audio_path, hotwords.clone(), auth, app_k, dur).await?
            }
        }
    } else {
        let base = asr_base_url
            .unwrap_or_else(|| "http://127.0.0.1:8741".to_string())
            .trim_end_matches('/')
            .to_string();
        let url = format!("{base}/v1/transcribe");
        post_transcribe_multipart(
            &st,
            &url,
            audio_path,
            hotwords,
            None,
            None,
            std::time::Duration::from_secs(600),
        ).await?
    };
    // 契约里 success 也可能带 `"error": null`（Pydantic optional）；仅非 null 视为硬错误。
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
            &format!("ERROR transcribe asr_payload code={code} {msg}"),
        );
        return Err(format!("ASR 返回错误 ({code}): {msg}"));
    }

    let engine = v
        .get("engine")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let mut warnings: Vec<String> = v
        .get("warnings")
        .and_then(|w| w.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(std::string::ToString::to_string))
                .collect()
        })
        .unwrap_or_default();

    let arr = v
        .get("segments")
        .and_then(|s| s.as_array())
        .ok_or_else(|| "响应缺少 segments 数组".to_string())?;
    let mut segments: Vec<SegmentDto> = Vec::new();
    for (i, row) in arr.iter().enumerate() {
        let start = row
            .get("start_sec")
            .and_then(|x| x.as_f64())
            .ok_or_else(|| format!("segment {i} start_sec"))?;
        let end = row
            .get("end_sec")
            .and_then(|x| x.as_f64())
            .ok_or_else(|| format!("segment {i} end_sec"))?;
        let text = row
            .get("text")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let confidence = row.get("confidence").and_then(|x| x.as_f64());
        let low_confidence = row
            .get("low_confidence")
            .and_then(|x| x.as_bool())
            .unwrap_or(false);
        let detail = row
            .get("detail")
            .and_then(|x| x.as_str())
            .filter(|s| !s.is_empty())
            .map(String::from);
        segments.push(SegmentDto {
            idx: i as i32,
            start_sec: start,
            end_sec: end,
            text,
            confidence,
            low_confidence,
            detail,
        });
    }
    if segments.is_empty() {
        append_desktop_log_line(&st, "INFO transcribe zero_segments_ok");
    }
    if let Ok(conn) = open_db(&st) {
        if let Ok(mut hint_warnings) = collect_correction_rule_hints(&conn, &segments) {
            warnings.append(&mut hint_warnings);
        }
    }
    fs::create_dir_all(st.root.join("logs")).map_err(|e| e.to_string())?;
    let recovery_path = st
        .root
        .join("logs")
        .join(format!("transcribe_recovery_{project_id}.json"));
    let recovery_doc = serde_json::json!({
        "kind": "transcribe_segments_recovery",
        "project_id": project_id,
        "saved_at_ms": now_ms(),
        "segments": &segments,
    });
    fs::write(
        &recovery_path,
        serde_json::to_vec_pretty(&recovery_doc).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("无法写入转写恢复文件: {e}"))?;
    match project_save_segments_inner(&st, &project_id, &segments) {
        Ok(()) => {
            let _ = fs::remove_file(&recovery_path);
        }
        Err(e) => {
            append_desktop_log_line(
                &st,
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
    let conn = open_db(&st)?;
    let detail = project_detail_from_conn(&conn, &project_id)?;
    Ok(RunTranscribeOutcome {
        detail,
        engine,
        warnings,
    })
}

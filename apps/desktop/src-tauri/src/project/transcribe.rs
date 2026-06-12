use super::online_segment_normalize::{
    assemblyai_words_to_timed_words, openai_words_to_timed_words, timed_words_to_json,
    timed_words_to_segments, OnlineSegmentNormalizeOptions,
};
use super::transcribe_cancel_cmd::{ensure_transcribe_not_cancelled, TranscribeCancelPoll};
use super::transcribe_errors::{
    describe_transcribe_http_status_error, describe_transcribe_request_error,
};
use super::transcribe_timeline::{TranscribeTimelineRecorder, STAGE_TRANSCRIBE, STAGE_UPLOAD};
use super::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::utils::{redact_http_body_snippet, redact_secrets_for_log};
use crate::DbState;
use std::path::Path;

pub use super::glossary_hotwords::build_glossary_hotwords;

#[derive(Default, Clone, Copy)]
pub struct TranscribeRequestAuth<'a> {
    pub authorization: Option<&'a str>,
    pub app_key: Option<&'a str>,
}

pub struct TranscribeHttpOptions<'a> {
    pub auth: TranscribeRequestAuth<'a>,
    pub timeout: std::time::Duration,
    pub cancel: TranscribeCancelPoll<'a>,
}

pub async fn post_transcribe_multipart(
    st: &DbState,
    url: &str,
    audio_path: &Path,
    hotwords: String,
    http: TranscribeHttpOptions<'_>,
    mut timeline: Option<&mut TranscribeTimelineRecorder>,
) -> Result<serde_json::Value, String> {
    if let Some(tl) = timeline.as_deref_mut() {
        tl.begin_stage(STAGE_UPLOAD);
    }
    let part = crate::stt_native::multipart_part_from_file(audio_path).await?;
    let form = {
        let mut f = reqwest::multipart::Form::new().part("file", part);
        if !hotwords.is_empty() {
            f = f.text("hotwords", hotwords);
        }
        f
    };
    let mut req = crate::asr_sidecar::local_token::apply_local_token_if_asr_loopback(
        http_client()
            .post(url)
            .multipart(form)
            .timeout(http.timeout),
        url,
    );
    if let Some(a) = http.auth.authorization {
        let t = a.trim();
        if !t.is_empty() {
            req = req.header("Authorization", t);
        }
    }
    if let Some(k) = http.auth.app_key {
        let t = k.trim();
        if !t.is_empty() {
            req = req.header("X-Rushi-Stt-App-Key", t);
        }
    }
    if let Some(tl) = timeline.as_deref_mut() {
        tl.begin_stage(STAGE_TRANSCRIBE);
    }
    ensure_transcribe_not_cancelled(http.cancel)?;
    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            append_desktop_log_line(
                st,
                &format!(
                    "ERROR transcribe connect {}",
                    redact_secrets_for_log(&e.to_string())
                ),
            );
            let msg = describe_transcribe_request_error(&e, http.timeout);
            if let Some(tl) = timeline {
                let code = super::transcribe_timeline::infer_transcribe_error_code(&msg);
                tl.fail_stage(STAGE_TRANSCRIBE, code, &msg);
            }
            return Err(msg);
        }
    };
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet = redact_http_body_snippet(&body);
        append_desktop_log_line(st, &format!("ERROR transcribe http {} {}", status, snippet));
        if let Some(msg) = describe_transcribe_http_status_error(status.as_u16(), &snippet) {
            if let Some(tl) = timeline {
                let code = super::transcribe_timeline::infer_transcribe_error_code(&msg);
                tl.fail_stage(STAGE_TRANSCRIBE, code, &msg);
            }
            return Err(msg);
        }
        let err = format!("ASR HTTP {}: {}", status, snippet);
        if let Some(tl) = timeline {
            tl.fail_stage(STAGE_TRANSCRIBE, "asr_payload", &err);
        }
        return Err(err);
    }
    let out = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            append_desktop_log_line(st, &format!("ERROR transcribe json {e}"));
            let err = e.to_string();
            if let Some(tl) = timeline {
                tl.fail_stage(STAGE_TRANSCRIBE, "asr_payload", &err);
            }
            return Err(err);
        }
    };
    Ok(out)
}

pub fn openai_verbose_json_to_rushi(v: &serde_json::Value) -> Result<serde_json::Value, String> {
    if let Some(err) = v.get("error") {
        if err.is_object() {
            let msg = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown");
            return Err(format!("OpenAI API: {msg}"));
        }
    }
    let duration_sec = v.get("duration").and_then(|x| x.as_f64());
    let full_text = v
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();
    let mut warnings: Vec<String> = Vec::new();
    let mut rushi_segments: Vec<serde_json::Value> =
        if let Some(rows) = v.get("segments").and_then(|s| s.as_array()) {
            if rows.is_empty() {
                Vec::new()
            } else {
                let mut out = Vec::with_capacity(rows.len());
                for (i, row) in rows.iter().enumerate() {
                    let start = row
                        .get("start")
                        .and_then(|x| x.as_f64())
                        .ok_or_else(|| format!("OpenAI segment {i} 缺少 start"))?;
                    let end = row.get("end").and_then(|x| x.as_f64()).unwrap_or(start);
                    let text = row
                        .get("text")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    out.push(serde_json::json!({
                        "start_sec": start,
                        "end_sec": end,
                        "text": text,
                        "confidence": serde_json::Value::Null,
                        "low_confidence": false,
                        "kind": "speech",
                    }));
                }
                out
            }
        } else {
            Vec::new()
        };
    if rushi_segments.len() <= 1 {
        if let Some(words) = v.get("words").and_then(|w| w.as_array()) {
            let timed = openai_words_to_timed_words(words);
            if !timed.is_empty() {
                rushi_segments =
                    timed_words_to_segments(&timed, &OnlineSegmentNormalizeOptions::default());
            }
        }
    }
    // 无子句但有全文 → 整轨占位兜底；显式标 placeholder，下游不再靠 0.85 跨度反推。
    let rushi_segments = if rushi_segments.is_empty() && !full_text.trim().is_empty() {
        vec![serde_json::json!({
            "start_sec": 0.0_f64,
            "end_sec": duration_sec.unwrap_or(0.0),
            "text": full_text.trim(),
            "confidence": serde_json::Value::Null,
            "low_confidence": false,
            "kind": "placeholder",
        })]
    } else {
        rushi_segments
    };
    if rushi_segments.is_empty() {
        warnings.push("OpenAI 返回空文本；请检查音频与模型。".to_string());
    }
    let mut doc = serde_json::json!({
        "schema_version": "1",
        "segments": rushi_segments,
        "full_text": full_text,
        "engine": "openai:whisper-1:verbose_json",
        "duration_sec": duration_sec,
        "warnings": warnings,
    });
    if let Some(words) = v.get("words").and_then(|w| w.as_array()) {
        let timed = openai_words_to_timed_words(words);
        if !timed.is_empty() {
            doc["timed_words"] = serde_json::json!(timed_words_to_json(&timed));
        }
    }
    Ok(doc)
}

pub fn assemblyai_words_to_segments(words: &[serde_json::Value]) -> Vec<serde_json::Value> {
    super::online_segment_normalize::assemblyai_words_to_segments(words)
}

/// AssemblyAI `audio_duration` 为毫秒（见官方 transcript JSON）。
fn assemblyai_audio_duration_sec(j: &serde_json::Value) -> Option<f64> {
    let ms = j
        .get("audio_duration")
        .and_then(|x| x.as_f64())
        .or_else(|| {
            j.get("audio_duration")
                .and_then(|x| x.as_i64().map(|n| n as f64))
        })?;
    Some((ms / 1000.0).max(0.0))
}

pub fn assemblyai_transcript_json_to_rushi(
    j: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    if let Some(err) = j.get("error").and_then(|e| e.as_str()) {
        if !err.is_empty() {
            return Err(format!("AssemblyAI: {err}"));
        }
    }
    let duration_sec = assemblyai_audio_duration_sec(j);
    let full_text = j
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();
    let mut warnings: Vec<String> = Vec::new();
    let mut rushi_segments: Vec<serde_json::Value> =
        if let Some(utt) = j.get("utterances").and_then(|u| u.as_array()) {
            if utt.is_empty() {
                Vec::new()
            } else {
                let mut out = Vec::with_capacity(utt.len());
                for u in utt.iter() {
                    let start_ms = u.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0);
                    let end_ms = u.get("end").and_then(|x| x.as_f64()).unwrap_or(start_ms);
                    let start_sec = start_ms / 1000.0;
                    let end_sec = end_ms / 1000.0;
                    let text = u
                        .get("text")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    let confidence = u.get("confidence").and_then(|x| x.as_f64());
                    out.push(serde_json::json!({
                        "start_sec": start_sec,
                        "end_sec": end_sec,
                        "text": text,
                        "confidence": confidence,
                        "low_confidence": false,
                        "kind": "speech",
                    }));
                }
                out
            }
        } else {
            Vec::new()
        };
    let mut timed_words_json: Vec<serde_json::Value> = Vec::new();
    if rushi_segments.is_empty() {
        if let Some(words) = j.get("words").and_then(|w| w.as_array()) {
            let timed = assemblyai_words_to_timed_words(words);
            if !timed.is_empty() {
                timed_words_json = timed_words_to_json(&timed);
            }
            rushi_segments = assemblyai_words_to_segments(words);
        }
    }
    let rushi_segments = if rushi_segments.is_empty() && !full_text.trim().is_empty() {
        vec![serde_json::json!({
            "start_sec": 0.0_f64,
            "end_sec": duration_sec.unwrap_or(0.0),
            "text": full_text.trim(),
            "confidence": serde_json::Value::Null,
            "low_confidence": false,
            "kind": "placeholder",
        })]
    } else {
        rushi_segments
    };
    if rushi_segments.is_empty() {
        warnings.push("AssemblyAI 返回空分句；请检查音频与账户额度。".to_string());
    }
    let mut doc = serde_json::json!({
        "schema_version": "1",
        "segments": rushi_segments,
        "full_text": full_text,
        "engine": "assemblyai:v2",
        "duration_sec": duration_sec,
        "warnings": warnings,
    });
    if !timed_words_json.is_empty() {
        doc["timed_words"] = serde_json::json!(timed_words_json);
    }
    Ok(doc)
}

#[cfg(test)]
mod assemblyai_tests {
    use super::*;

    #[test]
    fn audio_duration_ms_converted_to_seconds() {
        let j = serde_json::json!({
            "audio_duration": 180_000,
            "text": "hello",
            "words": [
                {"text": "hello", "start": 0.0, "end": 500.0}
            ]
        });
        let out = assemblyai_transcript_json_to_rushi(&j).expect("ok");
        assert!((out["duration_sec"].as_f64().unwrap() - 180.0).abs() < 0.001);
        assert!(out.get("timed_words").and_then(|w| w.as_array()).is_some());
    }

    #[test]
    fn placeholder_end_uses_duration_sec_not_raw_ms() {
        let j = serde_json::json!({
            "audio_duration": 120_000,
            "text": "only one block"
        });
        let out = assemblyai_transcript_json_to_rushi(&j).expect("ok");
        let seg = &out["segments"].as_array().unwrap()[0];
        assert!((seg["end_sec"].as_f64().unwrap() - 120.0).abs() < 0.001);
    }
}

use super::transcribe_errors::{
    describe_transcribe_http_status_error, describe_transcribe_request_error,
};
use super::utils::append_desktop_log_line;
use crate::utils::http_client;
use crate::utils::{redact_http_body_snippet, redact_secrets_for_log};
use crate::DbState;
use std::path::Path;

pub use super::glossary_hotwords::build_glossary_hotwords;

pub async fn post_transcribe_multipart(
    st: &DbState,
    url: &str,
    audio_path: &Path,
    hotwords: String,
    authorization: Option<&str>,
    app_key: Option<&str>,
    timeout: std::time::Duration,
) -> Result<serde_json::Value, String> {
    let part = crate::stt_native::multipart_part_from_file(audio_path).await?;
    let form = {
        let mut f = reqwest::multipart::Form::new().part("file", part);
        if !hotwords.is_empty() {
            f = f.text("hotwords", hotwords);
        }
        f
    };
    let mut req = crate::asr_sidecar::local_token::apply_local_token_if_asr_loopback(
        http_client().post(url).multipart(form).timeout(timeout),
        url,
    );
    if let Some(a) = authorization {
        let t = a.trim();
        if !t.is_empty() {
            req = req.header("Authorization", t);
        }
    }
    if let Some(k) = app_key {
        let t = k.trim();
        if !t.is_empty() {
            req = req.header("X-Rushi-Stt-App-Key", t);
        }
    }
    let resp = req.send().await.map_err(|e| {
        append_desktop_log_line(
            st,
            &format!(
                "ERROR transcribe connect {}",
                redact_secrets_for_log(&e.to_string())
            ),
        );
        describe_transcribe_request_error(&e, timeout)
    })?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet = redact_http_body_snippet(&body);
        append_desktop_log_line(st, &format!("ERROR transcribe http {} {}", status, snippet));
        if let Some(msg) =
            describe_transcribe_http_status_error(status.as_u16(), &snippet)
        {
            return Err(msg);
        }
        return Err(format!("ASR HTTP {}: {}", status, snippet));
    }
    resp.json().await.map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR transcribe json {e}"));
        e.to_string()
    })
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
    let rushi_segments: Vec<serde_json::Value> =
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
    Ok(serde_json::json!({
        "schema_version": "1",
        "segments": rushi_segments,
        "full_text": full_text,
        "engine": "openai:whisper-1:verbose_json",
        "duration_sec": duration_sec,
        "warnings": warnings,
    }))
}

pub fn assemblyai_words_to_segments(words: &[serde_json::Value]) -> Vec<serde_json::Value> {
    if words.is_empty() {
        return Vec::new();
    }
    const GAP_SEC: f64 = 0.85;
    let mut out: Vec<serde_json::Value> = Vec::new();
    let mut seg_start_ms: Option<f64> = None;
    let mut seg_end_ms: f64 = 0.0;
    let mut buf = String::new();

    for w in words {
        let s_ms = w.get("start").and_then(|x| x.as_f64()).unwrap_or(0.0);
        let e_ms = w.get("end").and_then(|x| x.as_f64()).unwrap_or(s_ms);
        let piece = w.get("text").and_then(|x| x.as_str()).unwrap_or("").trim();
        if piece.is_empty() {
            continue;
        }
        match seg_start_ms {
            None => {
                seg_start_ms = Some(s_ms);
                seg_end_ms = e_ms;
                buf.push_str(piece);
            }
            Some(s0) => {
                let gap = (s_ms - seg_end_ms) / 1000.0;
                if gap > GAP_SEC {
                    let text = std::mem::take(&mut buf).trim().to_string();
                    if !text.is_empty() {
                        out.push(serde_json::json!({
                            "start_sec": s0 / 1000.0,
                            "end_sec": seg_end_ms / 1000.0,
                            "text": text,
                            "confidence": serde_json::Value::Null,
                            "low_confidence": false,
                            "kind": "speech",
                        }));
                    }
                    seg_start_ms = Some(s_ms);
                    seg_end_ms = e_ms;
                    buf.push_str(piece);
                } else {
                    buf.push(' ');
                    buf.push_str(piece);
                    seg_end_ms = e_ms;
                }
            }
        }
    }
    if let Some(s0) = seg_start_ms {
        let text = buf.trim().to_string();
        if !text.is_empty() {
            out.push(serde_json::json!({
                "start_sec": s0 / 1000.0,
                "end_sec": seg_end_ms / 1000.0,
                "text": text,
                "confidence": serde_json::Value::Null,
                "low_confidence": false,
                "kind": "speech",
            }));
        }
    }
    out
}

pub fn assemblyai_transcript_json_to_rushi(
    j: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    if let Some(err) = j.get("error").and_then(|e| e.as_str()) {
        if !err.is_empty() {
            return Err(format!("AssemblyAI: {err}"));
        }
    }
    let duration_sec = j
        .get("audio_duration")
        .and_then(|x| x.as_f64())
        .or_else(|| {
            j.get("audio_duration")
                .and_then(|x| x.as_i64().map(|n| n as f64))
        });
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
    if rushi_segments.is_empty() {
        if let Some(words) = j.get("words").and_then(|w| w.as_array()) {
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
    Ok(serde_json::json!({
        "schema_version": "1",
        "segments": rushi_segments,
        "full_text": full_text,
        "engine": "assemblyai:v2",
        "duration_sec": duration_sec,
        "warnings": warnings,
    }))
}

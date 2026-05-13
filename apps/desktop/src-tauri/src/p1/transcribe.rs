use super::types::BLOCKING_CLIENT;
use super::utils::append_desktop_log_line;
use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, P1OnlineTranscribeBridge};
use crate::DbState;
use reqwest::blocking::multipart;
use rusqlite::Connection;
use std::fs;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

/// 术语表拼接为 FunASR 期望的空格分隔热词串（与 ASR `hotwords` 表单字段对齐）。
pub fn glossary_hotwords_joined(conn: &Connection) -> Result<String, String> {
    let mut stmt = conn
        .prepare("SELECT term FROM glossary_terms ORDER BY term COLLATE NOCASE ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut parts: Vec<String> = Vec::new();
    for r in rows {
        let t: String = r.map_err(|e| e.to_string())?;
        let u = t.trim();
        if !u.is_empty() {
            parts.push(u.to_string());
        }
    }
    let mut s = parts.join(" ");
    const MAX: usize = 12_000;
    if s.len() > MAX {
        s.truncate(MAX);
        while !s.is_empty() && !s.is_char_boundary(s.len()) {
            s.pop();
        }
        if let Some(i) = s.rfind(' ') {
            if i > MAX / 2 {
                s.truncate(i);
            }
        }
    }
    Ok(s)
}

pub fn post_transcribe_multipart(
    st: &DbState,
    url: &str,
    audio_path: &Path,
    hotwords: String,
    authorization: Option<&str>,
    app_key: Option<&str>,
    timeout: std::time::Duration,
) -> Result<serde_json::Value, String> {
    let part = multipart::Part::file(audio_path).map_err(|e| e.to_string())?;
    let form = {
        let mut f = multipart::Form::new().part("file", part);
        if !hotwords.is_empty() {
            f = f.text("hotwords", hotwords);
        }
        f
    };
    let client = BLOCKING_CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest blocking client build")
    });
    let mut req = client.post(url).multipart(form).timeout(timeout);
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
    let resp = req.send().map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR transcribe connect {e}"));
        format!("ASR 请求失败: {e}")
    })?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().unwrap_or_default();
        let snippet: String = body.chars().take(500).collect();
        append_desktop_log_line(st, &format!("ERROR transcribe http {} {}", status, snippet));
        return Err(format!("ASR HTTP {}: {}", status, snippet));
    }
    resp.json().map_err(|e| {
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
                    }));
                }
                out
            }
        } else {
            Vec::new()
        };
    let rushi_segments = if rushi_segments.is_empty() && !full_text.trim().is_empty() {
        vec![serde_json::json!({
            "start_sec": 0.0_f64,
            "end_sec": duration_sec.unwrap_or(0.0),
            "text": full_text.trim(),
            "confidence": serde_json::Value::Null,
            "low_confidence": false,
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

pub fn transcribe_openai_native(
    st: &DbState,
    audio_path: &Path,
    hotwords: &str,
    o: &P1OnlineTranscribeBridge,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let url = o.transcribe_url.trim();
    if url.is_empty() {
        return Err("在线转写 URL 为空".to_string());
    }
    if !is_allowed_stt_transcribe_url(url) {
        return Err(
            "在线转写 URL 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1".to_string(),
        );
    }
    let auth_ok = o
        .authorization
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_some();
    if !auth_ok {
        return Err("OpenAI 转写需要 Authorization（Bearer Token）。".to_string());
    }
    let part = multipart::Part::file(audio_path).map_err(|e| e.to_string())?;
    let mut form = multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-1")
        .text("response_format", "verbose_json");
    let prompt = hotwords.trim();
    if !prompt.is_empty() {
        let p: String = prompt.chars().take(224).collect();
        form = form.text("prompt", p);
    }
    let mut req = crate::stt_native::http_client()
        .post(url)
        .timeout(timeout)
        .multipart(form);
    if let Some(a) = o.authorization.as_deref() {
        let t = a.trim();
        if !t.is_empty() {
            req = req.header("Authorization", t);
        }
    }
    append_desktop_log_line(st, "INFO transcribe openai_native");
    let resp = req.send().map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR openai transcribe connect {e}"));
        format!("OpenAI 请求失败: {e}")
    })?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().unwrap_or_default();
        let snippet: String = body.chars().take(500).collect();
        append_desktop_log_line(
            st,
            &format!("ERROR openai transcribe http {} {}", status, snippet),
        );
        return Err(format!("OpenAI HTTP {}: {}", status, snippet));
    }
    let val: serde_json::Value = resp.json().map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR openai transcribe json {e}"));
        e.to_string()
    })?;
    openai_verbose_json_to_rushi(&val)
}

pub fn transcribe_assemblyai_native(
    st: &DbState,
    audio_path: &Path,
    o: &P1OnlineTranscribeBridge,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let base = o.transcribe_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("AssemblyAI base URL 为空".to_string());
    }
    if !is_allowed_stt_transcribe_url(base) {
        return Err(
            "AssemblyAI base 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1".to_string(),
        );
    }
    let auth = o
        .authorization
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "AssemblyAI 缺少 authorization / API Key".to_string())?;
    let deadline = Instant::now() + timeout;
    let client = crate::stt_native::http_client();
    let bytes = fs::read(audio_path).map_err(|e| format!("读取音频失败: {e}"))?;
    append_desktop_log_line(st, "INFO transcribe assemblyai_upload");
    let upload_res = client
        .post(format!("{base}/v2/upload"))
        .timeout(timeout)
        .header("authorization", auth)
        .header("Content-Type", "application/octet-stream")
        .body(bytes)
        .send()
        .map_err(|e| format!("AssemblyAI 上传失败: {e}"))?;
    if !upload_res.status().is_success() {
        let status = upload_res.status();
        let body = upload_res.text().unwrap_or_default();
        let snippet: String = body.chars().take(400).collect();
        return Err(format!("AssemblyAI 上传 HTTP {status}: {snippet}"));
    }
    let upload_json: serde_json::Value = upload_res.json().map_err(|e| e.to_string())?;
    let audio_url = upload_json
        .get("upload_url")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "AssemblyAI 上传响应缺少 upload_url".to_string())?;
    append_desktop_log_line(st, "INFO transcribe assemblyai_create");
    let create_res = client
        .post(format!("{base}/v2/transcript"))
        .timeout(timeout)
        .header("authorization", auth)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "audio_url": audio_url }))
        .send()
        .map_err(|e| format!("AssemblyAI 创建任务失败: {e}"))?;
    if !create_res.status().is_success() {
        let status = create_res.status();
        let body = create_res.text().unwrap_or_default();
        let snippet: String = body.chars().take(400).collect();
        return Err(format!("AssemblyAI 创建转写 HTTP {status}: {snippet}"));
    }
    let created: serde_json::Value = create_res.json().map_err(|e| e.to_string())?;
    let tid = created
        .get("id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "AssemblyAI 创建响应缺少 id".to_string())?;
    loop {
        if Instant::now() > deadline {
            return Err("AssemblyAI 轮询超时".to_string());
        }
        thread::sleep(Duration::from_secs(2));
        let poll = client
            .get(format!("{base}/v2/transcript/{tid}"))
            .timeout(Duration::from_secs(30))
            .header("authorization", auth)
            .send()
            .map_err(|e| format!("AssemblyAI 轮询失败: {e}"))?;
        if !poll.status().is_success() {
            let status = poll.status();
            let body = poll.text().unwrap_or_default();
            let snippet: String = body.chars().take(400).collect();
            return Err(format!("AssemblyAI 状态 HTTP {status}: {snippet}"));
        }
        let j: serde_json::Value = poll.json().map_err(|e| e.to_string())?;
        match j.get("status").and_then(|s| s.as_str()) {
            Some("completed") => {
                append_desktop_log_line(st, "INFO transcribe assemblyai_completed");
                return assemblyai_transcript_json_to_rushi(&j);
            }
            Some("error") => {
                let msg = j
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("转写失败");
                return Err(format!("AssemblyAI: {msg}"));
            }
            Some("queued") | Some("processing") => continue,
            _ => continue,
        }
    }
}

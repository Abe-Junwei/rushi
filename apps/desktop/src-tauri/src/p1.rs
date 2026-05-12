//! P1: local project persistence, ASR pull, segment CRUD, edit log.
//! P2: segment confidence / low_confidence / detail; local glossary_terms.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::{collections::HashMap, collections::HashSet};

use reqwest::blocking::multipart;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::ops::Deref;
use tauri::{Manager, State};
use uuid::Uuid;

use crate::asr_sidecar;
use crate::db;
use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, P1OnlineTranscribeBridge};
use crate::DbState;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .expect("system time before UNIX_EPOCH")
}

static DESKTOP_LOG_MUTEX: Mutex<()> = Mutex::new(());
const DESKTOP_LOG_MAX_BYTES: u64 = 10 * 1024 * 1024;

fn append_desktop_log_line(st: &DbState, line: &str) {
    let _g = DESKTOP_LOG_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
    let dir = st.root.join("logs");
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("desktop.log");
    if let Ok(meta) = fs::metadata(&path) {
        if meta.len() > DESKTOP_LOG_MAX_BYTES {
            let rotated = dir.join("desktop.log.1");
            let _ = fs::rename(&path, &rotated);
        }
    }
    let ts = now_ms();
    let clean = line.replace('\n', " ").replace('\r', " ");
    let line_bytes = format!("{ts}\t{clean}\n");
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = f.write_all(line_bytes.as_bytes());
    }
}

/// 术语表拼接为 FunASR 期望的空格分隔热词串（与 ASR `hotwords` 表单字段对齐）。
fn glossary_hotwords_joined(conn: &Connection) -> Result<String, String> {
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

const CORRECTION_RULE_WARNING_PREFIX: &str = "correction_rule_hint:";

fn load_project_segment_texts(
    conn: &Connection,
    project_id: &str,
) -> Result<HashMap<i32, String>, String> {
    let mut stmt = conn
        .prepare("SELECT idx, text FROM segments WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |r| {
            Ok((r.get::<_, i32>(0)?, r.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut out = HashMap::new();
    for row in rows {
        let (idx, text) = row.map_err(|e| e.to_string())?;
        out.insert(idx, text);
    }
    Ok(out)
}

/// 从前后文本中提取“单一替换片段”（用于错词记忆），例如“安波那那” -> “安那般那”。
fn infer_single_replacement(before: &str, after: &str) -> Option<(String, String)> {
    let b = before.trim();
    let a = after.trim();
    if b.is_empty() || a.is_empty() || b == a {
        return None;
    }
    let b_chars: Vec<char> = b.chars().collect();
    let a_chars: Vec<char> = a.chars().collect();
    if b_chars.len() > 80 || a_chars.len() > 80 {
        return None;
    }
    let mut left = 0usize;
    while left < b_chars.len() && left < a_chars.len() && b_chars[left] == a_chars[left] {
        left += 1;
    }
    let mut right = 0usize;
    while right + left < b_chars.len()
        && right + left < a_chars.len()
        && b_chars[b_chars.len() - 1 - right] == a_chars[a_chars.len() - 1 - right]
    {
        right += 1;
    }
    let removed: String = b_chars[left..(b_chars.len().saturating_sub(right))]
        .iter()
        .collect::<String>()
        .trim()
        .to_string();
    let added: String = a_chars[left..(a_chars.len().saturating_sub(right))]
        .iter()
        .collect::<String>()
        .trim()
        .to_string();
    if removed.is_empty() || added.is_empty() || removed == added {
        return None;
    }
    if removed.chars().count() > 24 || added.chars().count() > 24 {
        return None;
    }
    if removed.chars().any(char::is_whitespace) || added.chars().any(char::is_whitespace) {
        return None;
    }
    Some((removed, added))
}

fn upsert_correction_memory(
    conn: &Connection,
    before_text: &str,
    after_text: &str,
    at_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO correction_memory \
         (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms)\
         VALUES (?1, ?2, 1, 0, ?3, ?3)\
         ON CONFLICT(before_text, after_text)\
         DO UPDATE SET hit_count = hit_count + 1, updated_at_ms = excluded.updated_at_ms",
        params![before_text, after_text, at_ms],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn update_correction_memory_from_save(
    conn: &Connection,
    old_text_by_idx: &HashMap<i32, String>,
    new_segments: &[SegmentDto],
) -> Result<(), String> {
    // 中文说明 | English: only learn from stable one-to-one edits to avoid noisy split/merge diffs.
    if old_text_by_idx.len() != new_segments.len() {
        return Ok(());
    }
    let at_ms = now_ms();
    for seg in new_segments {
        let Some(prev) = old_text_by_idx.get(&seg.idx) else {
            continue;
        };
        if let Some((before_text, after_text)) = infer_single_replacement(prev, &seg.text) {
            upsert_correction_memory(conn, &before_text, &after_text, at_ms)?;
        }
    }
    Ok(())
}

fn collect_correction_rule_hints(
    conn: &Connection,
    segments: &[SegmentDto],
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text FROM correction_memory \
             WHERE accepted_as_rule = 1 OR hit_count >= 2 \
             ORDER BY accepted_as_rule DESC, hit_count DESC, updated_at_ms DESC \
             LIMIT 40",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for row in rows {
        let (before_text, after_text) = row.map_err(|e| e.to_string())?;
        if before_text.trim().is_empty() || after_text.trim().is_empty() {
            continue;
        }
        if segments
            .iter()
            .any(|s| s.text.contains(&before_text) && !s.text.contains(&after_text))
            && seen.insert((before_text.clone(), after_text.clone()))
        {
            out.push(format!(
                "{CORRECTION_RULE_WARNING_PREFIX}{before_text}->{after_text}"
            ));
            if out.len() >= 5 {
                break;
            }
        }
    }
    Ok(out)
}

fn open_db(state: &DbState) -> Result<Connection, String> {
    let conn = Connection::open(&state.db_path).map_err(|e| e.to_string())?;
    conn.execute("PRAGMA foreign_keys = ON;", [])
        .map_err(|e| e.to_string())?;
    conn.execute("PRAGMA busy_timeout = 5000;", [])
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn project_detail_from_conn(conn: &Connection, project_id: &str) -> Result<ProjectDetail, String> {
    let (name, audio_path, c_ms, u_ms): (String, String, i64, i64) = conn
        .query_row(
            "SELECT name, audio_storage_path, created_at_ms, updated_at_ms FROM projects WHERE id = ?1",
            params![project_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT idx, start_sec, end_sec, text, confidence, low_confidence, detail \
             FROM segments WHERE project_id = ?1 ORDER BY idx ASC",
        )
        .map_err(|e| e.to_string())?;
    let segs = stmt
        .query_map(params![project_id], |r| {
            let detail: String = r.get(6)?;
            Ok(SegmentDto {
                idx: r.get(0)?,
                start_sec: r.get(1)?,
                end_sec: r.get(2)?,
                text: r.get(3)?,
                confidence: r.get(4)?,
                low_confidence: r.get::<_, i64>(5)? != 0,
                detail: if detail.is_empty() {
                    None
                } else {
                    Some(detail)
                },
            })
        })
        .map_err(|e| e.to_string())?;
    let mut segments = Vec::new();
    for s in segs {
        segments.push(s.map_err(|e| e.to_string())?);
    }
    Ok(ProjectDetail {
        id: project_id.to_string(),
        name,
        audio_storage_path: audio_path,
        created_at_ms: c_ms,
        updated_at_ms: u_ms,
        segments,
    })
}

/// 拉取语段命令的返回值：项目详情 + ASR 元信息（用于前端提示 stub / FunASR 等）。
#[derive(Debug, Serialize)]
pub struct RunTranscribeOutcome {
    pub detail: ProjectDetail,
    pub engine: String,
    pub warnings: Vec<String>,
}

fn post_transcribe_multipart(
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
    let client = reqwest::blocking::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client.post(url).multipart(form);
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
        append_desktop_log_line(
            st,
            &format!("ERROR transcribe http {} {}", status, snippet),
        );
        return Err(format!("ASR HTTP {}: {}", status, snippet));
    }
    resp.json().map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR transcribe json {e}"));
        e.to_string()
    })
}

fn openai_verbose_json_to_rushi(v: &serde_json::Value) -> Result<serde_json::Value, String> {
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
    let rushi_segments: Vec<serde_json::Value> = if let Some(rows) = v.get("segments").and_then(|s| s.as_array()) {
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

fn assemblyai_words_to_segments(words: &[serde_json::Value]) -> Vec<serde_json::Value> {
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

fn assemblyai_transcript_json_to_rushi(j: &serde_json::Value) -> Result<serde_json::Value, String> {
    if let Some(err) = j.get("error").and_then(|e| e.as_str()) {
        if !err.is_empty() {
            return Err(format!("AssemblyAI: {err}"));
        }
    }
    let duration_sec = j
        .get("audio_duration")
        .and_then(|x| x.as_f64())
        .or_else(|| j.get("audio_duration").and_then(|x| x.as_i64().map(|n| n as f64)));
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

fn transcribe_openai_native(
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

fn transcribe_assemblyai_native(
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

#[derive(Debug, Serialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct ProjectDetail {
    pub id: String,
    pub name: String,
    pub audio_storage_path: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub segments: Vec<SegmentDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentDto {
    pub idx: i32,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
    #[serde(default)]
    pub confidence: Option<f64>,
    #[serde(default)]
    pub low_confidence: bool,
    #[serde(default)]
    pub detail: Option<String>,
}

fn project_save_segments_inner(state: &DbState, project_id: &str, segments: &[SegmentDto]) -> Result<(), String> {
    let mut conn = open_db(state)?;
    let old_text_by_idx = load_project_segment_texts(&conn, project_id)?;
    let t = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM segments WHERE project_id = ?1", params![project_id])
        .map_err(|e| e.to_string())?;
    for s in segments {
        let low = if s.low_confidence { 1i64 } else { 0i64 };
        let detail = s.detail.as_deref().unwrap_or("");
        tx.execute(
            "INSERT INTO segments (project_id, idx, start_sec, end_sec, text, confidence, low_confidence, detail) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                project_id,
                s.idx,
                s.start_sec,
                s.end_sec,
                s.text.as_str(),
                s.confidence,
                low,
                detail,
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.execute(
        "UPDATE projects SET updated_at_ms = ?1 WHERE id = ?2",
        params![t, project_id],
    )
    .map_err(|e| e.to_string())?;
    let detail = serde_json::json!({
        "op": "save_segments",
        "count": segments.len(),
        "at_ms": t,
    })
    .to_string();
    tx.execute(
        "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, t, "save_segments", detail.as_str()],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    if let Err(e) = update_correction_memory_from_save(&conn, &old_text_by_idx, segments) {
        append_desktop_log_line(
            state,
            &format!("WARN correction_memory_update_failed {e}"),
        );
    }
    Ok(())
}

fn is_sqlite_unique_violation(err: &rusqlite::Error) -> bool {
    /// `SQLITE_CONSTRAINT_UNIQUE` (see sqlite.org/rescode.html)
    const SQLITE_CONSTRAINT_UNIQUE: i32 = 2067;
    matches!(
        err,
        rusqlite::Error::SqliteFailure(sqlite_err, _) if sqlite_err.extended_code == SQLITE_CONSTRAINT_UNIQUE
    )
}

fn remove_project_audio_parent_dir(root: &Path, audio_storage_path: &str) -> Result<(), String> {
    let pb = PathBuf::from(audio_storage_path);
    let Some(parent) = pb.parent() else {
        return Ok(());
    };
    if !parent.exists() {
        return Ok(());
    }
    let sm = fs::symlink_metadata(parent)
        .map_err(|e| format!("无法读取项目目录元数据: {e}"))?;
    if sm.file_type().is_symlink() {
        return Err("拒绝删除：项目目录为符号链接，请先移除链接。".into());
    }
    let root_can =
        fs::canonicalize(root).map_err(|e| format!("无法解析应用数据根目录: {e}"))?;
    let parent_can = fs::canonicalize(parent).map_err(|e| format!("无法解析项目目录: {e}"))?;
    if !parent_can.starts_with(&root_can) {
        return Err("拒绝删除：项目目录不在应用数据根之下。".into());
    }
    fs::remove_dir_all(&parent_can).map_err(|e| format!("删除项目目录失败: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn p1_pick_audio_path() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter(
            "音视频",
            &[
                "wav", "mp3", "m4a", "aac", "flac", "ogg", "mp4", "webm", "mov", "caf", "aiff",
            ],
        )
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn p1_project_create(state: State<DbState>, name: String, src_path: String) -> Result<ProjectDetail, String> {
    let st: &DbState = state.deref();
    let src = PathBuf::from(&src_path);
    if !src.is_file() {
        return Err(format!("源文件不存在: {src_path}"));
    }
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("dat")
        .to_ascii_lowercase();
    let id = Uuid::new_v4().to_string();
    let dest_dir = st.root.join("projects").join(&id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest_audio = dest_dir.join(format!("audio.{ext}"));
    fs::copy(&src, &dest_audio).map_err(|e| {
        let _ = fs::remove_dir_all(&dest_dir);
        e.to_string()
    })?;
    let dest_str = dest_audio.to_string_lossy().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    if let Err(e) = conn.execute(
        "INSERT INTO projects (id, name, audio_storage_path, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&id, &name, &dest_str, t, t],
    ) {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err(e.to_string());
    }
    project_detail_from_conn(&conn, &id)
}

#[tauri::command]
pub fn p1_project_list(state: State<DbState>) -> Result<Vec<ProjectSummary>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare("SELECT id, name, updated_at_ms FROM projects ORDER BY updated_at_ms DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ProjectSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                updated_at_ms: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn p1_project_load(state: State<DbState>, project_id: String) -> Result<ProjectDetail, String> {
    let conn = open_db(state.deref())?;
    project_detail_from_conn(&conn, &project_id)
}

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
    tauri::async_runtime::spawn_blocking(move || {
        p1_project_run_transcribe_inner(st, project_id, asr_base_url, online)
    })
    .await
    .map_err(|e| format!("转写任务执行失败: {e}"))?
}

fn p1_project_run_transcribe_inner(
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
            Some("openaiAudio") => transcribe_openai_native(&st, audio_path, &hotwords, o, dur)?,
            Some("assemblyai") => transcribe_assemblyai_native(&st, audio_path, o, dur)?,
            Some(
                adapter @ ("baiduSpeech"
                | "aliyunNls"
                | "deepgramListen"
                | "tencentAsr"
                | "azureConversationV1"
                | "googleSpeechV1"),
            ) => {
                let client = crate::stt_native::http_client();
                let log = |line: &str| append_desktop_log_line(&st, line);
                crate::stt_native::dispatch_native(adapter, client, audio_path, o, dur, &log)?
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
                post_transcribe_multipart(
                    &st,
                    url,
                    audio_path,
                    hotwords.clone(),
                    auth,
                    app_k,
                    dur,
                )?
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
        )?
    };
    // 契约里 success 也可能带 `"error": null`（Pydantic optional）；仅非 null 视为硬错误。
    if let Some(err) = v.get("error").filter(|e| !e.is_null()) {
        let msg = err
            .get("message")
            .and_then(|m| m.as_str())
            .map(String::from)
            .or_else(|| err.as_str().map(String::from))
            .unwrap_or_else(|| err.to_string());
        let code = err.get("code").and_then(|c| c.as_str()).unwrap_or("unknown");
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

/// 弹出系统「另存为」并写入 UTF-8 文本（Tauri WebView 内程序化 `<a download>` 常无效果）。
#[tauri::command]
pub fn p1_export_text_file(default_filename: String, content: String) -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new().set_file_name(&default_filename).save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    if path.exists() {
        return Err("目标文件已存在，请另选文件名或先删除该文件。".into());
    }
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {e}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn p1_project_delete(state: State<DbState>, project_id: String) -> Result<(), String> {
    let st: &DbState = state.deref();
    let conn = open_db(st)?;
    let audio_path: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT audio_storage_path FROM projects WHERE id = ?1",
        params![&project_id],
        |r| r.get(0),
    );
    let audio_path = match audio_path {
        Ok(p) => Some(p),
        Err(rusqlite::Error::QueryReturnedNoRows) => None,
        Err(e) => return Err(e.to_string()),
    };
    conn.execute("DELETE FROM projects WHERE id = ?1", params![&project_id])
        .map_err(|e| e.to_string())?;
    drop(conn);
    if let Some(p) = audio_path {
        if let Err(e) = remove_project_audio_parent_dir(&st.root, &p) {
            append_desktop_log_line(
                st,
                &format!("ERROR project_delete_cleanup project_id={project_id} {e}"),
            );
            return Err(format!(
                "项目记录已从数据库删除，但清理磁盘失败：{e}"
            ));
        }
    }
    Ok(())
}

// --- P2 glossary（热词注入等后续再接 ASR；当前仅本地持久化） ---

#[derive(Debug, Serialize)]
pub struct GlossaryTermDto {
    pub id: i64,
    pub term: String,
    pub created_at_ms: i64,
}

#[tauri::command]
pub fn p2_glossary_list(state: State<DbState>) -> Result<Vec<GlossaryTermDto>, String> {
    let conn = open_db(state.deref())?;
    let mut stmt = conn
        .prepare("SELECT id, term, created_at_ms FROM glossary_terms ORDER BY term COLLATE NOCASE ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(GlossaryTermDto {
                id: r.get(0)?,
                term: r.get(1)?,
                created_at_ms: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn p2_glossary_add(state: State<DbState>, term: String) -> Result<GlossaryTermDto, String> {
    let t = term.trim().to_string();
    if t.is_empty() {
        return Err("术语不能为空".to_string());
    }
    let conn = open_db(state.deref())?;
    let now = now_ms();
    let res = conn.execute(
        "INSERT INTO glossary_terms (term, created_at_ms) VALUES (?1, ?2)",
        params![t.as_str(), now],
    );
    if let Err(e) = res {
        if is_sqlite_unique_violation(&e) {
            return Err("该术语已存在（忽略大小写）".to_string());
        }
        return Err(e.to_string());
    }
    let id = conn.last_insert_rowid();
    Ok(GlossaryTermDto {
        id,
        term: t,
        created_at_ms: now,
    })
}

#[tauri::command]
pub fn p2_glossary_delete(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    let n = conn
        .execute("DELETE FROM glossary_terms WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("未找到该术语".to_string());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn run_funasr_install_script(repo_root: &Path) -> Result<String, String> {
    use std::process::Command;
    let script = repo_root.join("scripts/install-funasr-for-desktop.sh");
    if !script.is_file() {
        return Err(format!("未找到安装脚本：{}", script.display()));
    }
    let out = Command::new("bash")
        .arg(&script)
        .current_dir(repo_root)
        .output()
        .map_err(|e| format!("无法执行 bash：{e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
    if !out.status.success() {
        return Err(format!(
            "安装脚本失败（退出码 {:?}）。\n--- stderr ---\n{stderr}\n--- stdout ---\n{stdout}",
            out.status.code()
        ));
    }
    Ok(format!("{stdout}\n{stderr}"))
}

/// 选择 Rushi 仓库根目录后，在 `services/asr/.venv` 中执行 `pip install -e ".[funasr]"`（耗网络与磁盘）。
#[tauri::command]
pub fn p1_install_funasr_deps_interactive(state: State<DbState>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = state;
        return Err(
            "当前版本仅在 macOS / Linux 支持从应用内一键安装；Windows 请按 services/asr/README.md 手动配置 venv 与 pip。"
                .into(),
        );
    }
    #[cfg(not(target_os = "windows"))]
    {
        let st: &DbState = state.deref();
        let picked = rfd::FileDialog::new()
            .set_title("选择 Rushi 源代码仓库根目录（内含 services/asr 与 scripts）")
            .pick_folder();
        let Some(root) = picked else {
            return Ok(None);
        };
        let marker = root.join("services/asr/pyproject.toml");
        if !marker.is_file() {
            return Err(format!(
                "所选目录不是有效的 Rushi 仓库根目录：未找到 {}",
                marker.display()
            ));
        }
        let log = run_funasr_install_script(&root)?;
        append_desktop_log_line(st, "INFO funasr_deps_install_script_ok");
        Ok(Some(log))
    }
}

/// 结束由壳拉起的 bundled 侧车（若有）并再次尝试启动（8741 空闲时）。
#[tauri::command]
pub fn p1_retry_bundled_asr_sidecar(app: tauri::AppHandle) {
    asr_sidecar::retry_bundled(&app);
}

fn reveal_path_in_file_manager(path: &Path) -> Result<(), String> {
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 在系统文件管理器中打开应用数据根目录（含 `models/`、`rushi.sqlite3` 等）。
#[tauri::command]
pub fn p1_open_app_data_folder(state: State<DbState>) -> Result<(), String> {
    let st: &DbState = state.deref();
    reveal_path_in_file_manager(&st.root)
}

pub fn setup_db(app: &tauri::AppHandle) -> Result<DbState, String> {
    let resolver = app.path();
    let mut base = resolver.app_data_dir().map_err(|e| e.to_string())?;
    base.push("studio.lingchuang.rushi");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let db_path = base.join("rushi.sqlite3");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::migrate(&conn).map_err(|e| e.to_string())?;
    drop(conn);
    let st = DbState {
        root: base,
        db_path,
    };
    append_desktop_log_line(&st, "INFO database_ready");
    Ok(st)
}

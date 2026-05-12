//! P1: local project persistence, ASR pull, segment CRUD, edit log.
//! P2: segment confidence / low_confidence / detail; local glossary_terms.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use reqwest::blocking::multipart;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::ops::Deref;
use tauri::{Manager, State};
use uuid::Uuid;

use crate::asr_sidecar;
use crate::db;
use crate::DbState;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn append_desktop_log_line(st: &DbState, line: &str) {
    let dir = st.root.join("logs");
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("desktop.log");
    let ts = now_ms();
    let clean = line.replace('\n', " ").replace('\r', " ");
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(f, "{ts}\t{clean}");
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
    }
    Ok(s)
}

fn open_db(state: &DbState) -> Result<Connection, String> {
    let conn = Connection::open(&state.db_path).map_err(|e| e.to_string())?;
    conn.execute("PRAGMA foreign_keys = ON;", [])
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
    fs::copy(&src, &dest_audio).map_err(|e| e.to_string())?;
    let dest_str = dest_audio.to_string_lossy().to_string();
    let t = now_ms();
    let conn = open_db(st)?;
    conn.execute(
        "INSERT INTO projects (id, name, audio_storage_path, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&id, &name, &dest_str, t, t],
    )
    .map_err(|e| e.to_string())?;
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
pub fn p1_project_run_transcribe(
    state: State<DbState>,
    project_id: String,
    asr_base_url: Option<String>,
) -> Result<RunTranscribeOutcome, String> {
    let st: &DbState = state.deref();
    let conn = open_db(st)?;
    let detail = project_detail_from_conn(&conn, &project_id)?;
    let hotwords = glossary_hotwords_joined(&conn)?;
    drop(conn);
    let audio_path = Path::new(&detail.audio_storage_path);
    if !audio_path.is_file() {
        append_desktop_log_line(st, "ERROR transcribe audio_missing");
        return Err("项目音频文件缺失".to_string());
    }
    let base = asr_base_url
        .unwrap_or_else(|| "http://127.0.0.1:8741".to_string())
        .trim_end_matches('/')
        .to_string();
    let url = format!("{base}/v1/transcribe");
    let part = multipart::Part::file(audio_path).map_err(|e| e.to_string())?;
    let form = {
        let mut f = multipart::Form::new().part("file", part);
        if !hotwords.is_empty() {
            f = f.text("hotwords", hotwords);
        }
        f
    };
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(&url)
        .multipart(form)
        .send()
        .map_err(|e| {
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
    let v: serde_json::Value = resp.json().map_err(|e| {
        append_desktop_log_line(st, &format!("ERROR transcribe json {e}"));
        e.to_string()
    })?;
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
            st,
            &format!("ERROR transcribe asr_payload code={code} {msg}"),
        );
        return Err(format!("ASR 返回错误 ({code}): {msg}"));
    }

    let engine = v
        .get("engine")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let warnings: Vec<String> = v
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
        append_desktop_log_line(st, "ERROR transcribe zero_segments");
        return Err("ASR 返回 0 条语段".to_string());
    }
    project_save_segments_inner(st, &project_id, &segments)?;
    let conn = open_db(st)?;
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
        let pb = PathBuf::from(&p);
        if let Some(parent) = pb.parent() {
            if parent.starts_with(&st.root) {
                let _ = fs::remove_dir_all(parent);
            }
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
        let msg = e.to_string();
        if msg.contains("UNIQUE") || msg.contains("unique") {
            return Err("该术语已存在（忽略大小写）".to_string());
        }
        return Err(msg);
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

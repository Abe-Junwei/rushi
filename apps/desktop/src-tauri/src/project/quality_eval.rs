//! R4 / R4-GATE: persist and validate eval-run JSON reports under app data.

use super::correction::list_correction_memory_entries;
use super::utils::open_db;
use crate::asr_sidecar::source::resolve_rushi_repo_root;
use crate::packaged_hints::dev_or_packaged_str;
use crate::DbState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

const REPORT_SCHEMA: &str = "1";
const QUALITY_DIR: &str = "quality";
const LAST_REPORT: &str = "last_eval_report.json";
const BASELINE_REPORT: &str = "baseline_eval_report.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityEvalReportItem {
    pub id: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(alias = "cer_chars")]
    pub cer_chars: Option<f64>,
    #[serde(alias = "term_hit_rate")]
    pub term_hit_rate: Option<f64>,
    #[serde(alias = "low_confidence_ratio")]
    pub low_confidence_ratio: Option<f64>,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub skipped: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityEvalReport {
    #[serde(alias = "schema_version")]
    pub schema_version: String,
    pub manifest: String,
    #[serde(alias = "asr_base")]
    pub asr_base: String,
    #[serde(default, alias = "hotwords_mode")]
    pub hotwords_mode: Option<String>,
    #[serde(default, alias = "hotwords_ab")]
    pub hotwords_ab: Option<bool>,
    #[serde(default, alias = "filter_id")]
    pub filter_id: Option<String>,
    #[serde(default, alias = "finished_at_ms")]
    pub finished_at_ms: Option<i64>,
    #[serde(default, alias = "exit_code")]
    pub exit_code: Option<i32>,
    pub items: Vec<QualityEvalReportItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityEvalRunResult {
    pub report: QualityEvalReport,
    pub had_errors: bool,
    pub report_path: String,
}

pub fn quality_dir(root: &Path) -> PathBuf {
    root.join(QUALITY_DIR)
}

pub fn last_report_path(root: &Path) -> PathBuf {
    quality_dir(root).join(LAST_REPORT)
}

pub fn baseline_report_path(root: &Path) -> PathBuf {
    quality_dir(root).join(BASELINE_REPORT)
}

pub fn parse_quality_report_json(raw: &str) -> Result<QualityEvalReport, String> {
    let report: QualityEvalReport =
        serde_json::from_str(raw).map_err(|e| format!("评测报告 JSON 无效: {e}"))?;
    if report.schema_version != REPORT_SCHEMA {
        return Err(format!(
            "不支持的 schema_version: {}（期望 {REPORT_SCHEMA}）",
            report.schema_version
        ));
    }
    if report.items.is_empty() {
        return Err("评测报告 items 为空".into());
    }
    Ok(report)
}

pub fn read_report_file(path: &Path) -> Result<QualityEvalReport, String> {
    let raw = fs::read_to_string(path).map_err(|e| format!("读取评测报告失败: {e}"))?;
    parse_quality_report_json(&raw)
}

pub fn write_report_file(path: &Path, report: &QualityEvalReport) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    let raw =
        serde_json::to_string_pretty(report).map_err(|e| format!("序列化评测报告失败: {e}"))?;
    fs::write(path, raw).map_err(|e| format!("写入评测报告失败: {e}"))
}

fn copy_report_if_exists(from: &Path, to: &Path) -> Result<(), String> {
    if !from.is_file() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(from, to).map_err(|e| format!("复制评测报告失败: {e}"))?;
    Ok(())
}

fn asr_health_ready(asr_base: &str) -> Result<(), String> {
    let url = format!("{}/health", asr_base.trim_end_matches('/'));
    let output = Command::new("curl")
        .args(["-sf", "--max-time", "3", &url])
        .output()
        .map_err(|e| format!("无法探测 ASR 健康状态: {e}"))?;
    if !output.status.success() {
        return Err(dev_or_packaged_str(
            "本机 ASR（127.0.0.1:8741）未就绪或 /health 无响应。请先 npm run desktop:dev 或检查侧车。",
            "本机 ASR（127.0.0.1:8741）未就绪。请在「环境与 ASR」完成一键准备或重试内置侧车。",
        )
        .into());
    }
    Ok(())
}

fn resolve_python3(repo: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        let win = repo.join("services/asr/.venv/Scripts/python.exe");
        if win.is_file() {
            return win;
        }
    }
    #[cfg(not(windows))]
    {
        let unix = repo.join("services/asr/.venv/bin/python");
        if unix.is_file() {
            return unix;
        }
    }
    PathBuf::from("python3")
}

pub fn run_eval_batch(
    app_root: &Path,
    filter_id: Option<&str>,
    hotwords_mode: &str,
) -> Result<QualityEvalRunResult, String> {
    let repo = resolve_rushi_repo_root().ok_or_else(|| {
        dev_or_packaged_str(
            "未找到仓库根目录（需含 scripts/eval-run.py）。请用 npm run desktop:dev 启动，或设置 RUSHI_REPO_ROOT。",
            "评测批量运行需在开发环境中执行（依赖仓库 scripts/eval-run.py）。安装包内请使用「导入评测报告 JSON」。",
        )
        .to_string()
    })?;
    let script = repo.join("scripts/eval-run.py");
    if !script.is_file() {
        return Err(format!("未找到评测脚本: {}", script.display()));
    }

    asr_health_ready("http://127.0.0.1:8741")?;

    let last = last_report_path(app_root);
    let baseline = baseline_report_path(app_root);
    if last.is_file() && !baseline.is_file() {
        let _ = copy_report_if_exists(&last, &baseline);
    }
    if last.is_file() {
        let prev = quality_dir(app_root).join("previous_eval_report.json");
        let _ = copy_report_if_exists(&last, &prev);
    }

    let mut cmd = Command::new(resolve_python3(&repo));
    cmd.current_dir(&repo)
        .arg(&script)
        .arg("--output")
        .arg(&last)
        .arg("--asr-base")
        .arg("http://127.0.0.1:8741")
        .arg("--hotwords-mode")
        .arg(hotwords_mode);
    if let Some(fid) = filter_id.map(str::trim).filter(|s| !s.is_empty()) {
        cmd.arg("--filter-id").arg(fid);
    }

    let output = cmd.output().map_err(|e| format!("启动评测脚本失败: {e}"))?;
    if !last.is_file() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "评测未生成报告文件。exit={} stderr={} stdout={}",
            output.status.code().unwrap_or(-1),
            stderr.trim(),
            stdout.chars().take(400).collect::<String>()
        ));
    }

    let mut report = read_report_file(&last)?;
    if report.finished_at_ms.is_none() {
        report.finished_at_ms = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0),
        );
    }
    if report.exit_code.is_none() {
        report.exit_code = output.status.code();
    }
    write_report_file(&last, &report)?;

    let had_errors = report
        .items
        .iter()
        .any(|it| it.error.as_ref().is_some_and(|e| !e.is_empty()));
    Ok(QualityEvalRunResult {
        had_errors,
        report_path: last.to_string_lossy().to_string(),
        report,
    })
}

pub fn export_correction_memory_jsonl(
    state: &DbState,
    dest: &Path,
    redact_text: bool,
) -> Result<(), String> {
    let conn = open_db(state)?;
    let rows = list_correction_memory_entries(&conn)?;
    let mut file = fs::File::create(dest).map_err(|e| format!("创建导出文件失败: {e}"))?;
    for row in rows {
        let (wrong, right) = if redact_text {
            (
                format!("[len:{}]", row.wrong.chars().count()),
                format!("[len:{}]", row.right.chars().count()),
            )
        } else {
            (row.wrong.clone(), row.right.clone())
        };
        let line = serde_json::json!({
            "wrong": wrong,
            "right": right,
            "hit_count": row.hit_count,
            "accepted_as_rule": row.accepted_as_rule,
            "updated_at_ms": row.updated_at_ms,
            "is_stable": row.is_stable,
            "redacted": redact_text,
        });
        let raw = serde_json::to_string(&line).map_err(|e| e.to_string())?;
        writeln!(file, "{raw}").map_err(|e| format!("写入 JSONL 失败: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn quality_get_last_report(state: State<DbState>) -> Result<Option<QualityEvalReport>, String> {
    let path = last_report_path(&state.root);
    if !path.is_file() {
        return Ok(None);
    }
    read_report_file(&path).map(Some)
}

#[tauri::command]
pub fn quality_get_baseline_report(
    state: State<DbState>,
) -> Result<Option<QualityEvalReport>, String> {
    let path = baseline_report_path(&state.root);
    if !path.is_file() {
        return Ok(None);
    }
    read_report_file(&path).map(Some)
}

#[tauri::command]
pub fn quality_save_report_from_json(
    state: State<DbState>,
    json: String,
) -> Result<QualityEvalReport, String> {
    let mut report = parse_quality_report_json(&json)?;
    if report.finished_at_ms.is_none() {
        report.finished_at_ms = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0),
        );
    }
    let path = last_report_path(&state.root);
    write_report_file(&path, &report)?;
    Ok(report)
}

#[tauri::command]
pub fn quality_import_report_file(
    state: State<DbState>,
) -> Result<Option<QualityEvalReport>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("JSON", &["json"])
        .pick_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    let report = read_report_file(&path)?;
    let dest = last_report_path(&state.root);
    write_report_file(&dest, &report)?;
    Ok(Some(report))
}

#[tauri::command]
pub fn quality_set_baseline_from_last(state: State<DbState>) -> Result<(), String> {
    let last = last_report_path(&state.root);
    if !last.is_file() {
        return Err("尚无最近一次评测报告，请先运行评测。".into());
    }
    let baseline = baseline_report_path(&state.root);
    copy_report_if_exists(&last, &baseline)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityRunEvalArgs {
    pub filter_id: Option<String>,
    #[serde(default = "default_hotwords_mode")]
    pub hotwords_mode: String,
}

fn default_hotwords_mode() -> String {
    "manifest".to_string()
}

#[tauri::command]
pub async fn quality_run_eval(
    state: State<'_, DbState>,
    args: Option<QualityRunEvalArgs>,
) -> Result<QualityEvalRunResult, String> {
    let args = args.unwrap_or_default();
    let mode = args.hotwords_mode.trim().to_string();
    if !matches!(mode.as_str(), "manifest" | "on" | "off") {
        return Err("hotwords_mode 须为 manifest、on 或 off".into());
    }
    let app_root = state.inner().root.clone();
    let filter_id = args.filter_id;
    tauri::async_runtime::spawn_blocking(move || {
        run_eval_batch(&app_root, filter_id.as_deref(), &mode)
    })
    .await
    .map_err(|e| format!("评测任务异常: {e}"))?
}

#[tauri::command]
pub fn quality_last_report_path_cmd(state: State<DbState>) -> Result<String, String> {
    Ok(last_report_path(&state.root).to_string_lossy().to_string())
}

#[tauri::command]
pub fn quality_export_correction_memory_jsonl(
    state: State<DbState>,
    redact_text: bool,
) -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .add_filter("JSONL", &["jsonl"])
        .set_file_name("correction-memory.jsonl")
        .save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    if path.exists() {
        return Err("目标文件已存在，请另选文件名。".into());
    }
    export_correction_memory_jsonl(state.deref(), &path, redact_text)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_report() {
        let raw = r#"{
          "schema_version": "1",
          "manifest": "fixtures/eval/eval_manifest.v1.json",
          "asr_base": "http://127.0.0.1:8741",
          "items": [{ "id": "x", "cer_chars": 0.1 }]
        }"#;
        let r = parse_quality_report_json(raw).expect("parse");
        assert_eq!(r.items[0].id, "x");
        assert!((r.items[0].cer_chars.unwrap() - 0.1).abs() < 1e-6);
    }
}

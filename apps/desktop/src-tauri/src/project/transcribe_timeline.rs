//! TRN-DIAG: structured transcribe task timeline for UI + diagnostic export.

use super::utils::now_ms;
use crate::DbState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const STAGE_PREFLIGHT: &str = "preflight";
pub const STAGE_UPLOAD: &str = "upload";
pub const STAGE_TRANSCRIBE: &str = "transcribe";
pub const STAGE_SAVE: &str = "save";

static ACTIVE_TIMELINE: Mutex<Option<(String, TranscribeTimelineRecorder)>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeTimelineEntry {
    pub stage: String,
    pub started_at_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_total: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeTimelineSnapshot {
    pub schema_version: u32,
    pub file_id: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
    pub started_at_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at_ms: Option<i64>,
    pub outcome: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_stage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_action: Option<String>,
    #[serde(rename = "transcribe_timeline")]
    pub transcribe_timeline: Vec<TranscribeTimelineEntry>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_count: Option<u32>,
}

pub struct TranscribeTimelineRecorder {
    file_id: String,
    source: String,
    job_id: Option<String>,
    started_at_ms: i64,
    entries: Vec<TranscribeTimelineEntry>,
    open_stage: Option<String>,
    open_started_ms: Option<i64>,
    outcome: Option<String>,
    failed_stage: Option<String>,
    error_code: Option<String>,
    error_message: Option<String>,
    warnings: Vec<String>,
    window_index: Option<u32>,
    window_count: Option<u32>,
}

impl TranscribeTimelineRecorder {
    pub fn new(file_id: &str, source: &str) -> Self {
        Self {
            file_id: file_id.to_string(),
            source: source.to_string(),
            job_id: None,
            started_at_ms: now_ms(),
            entries: Vec::new(),
            open_stage: None,
            open_started_ms: None,
            outcome: None,
            failed_stage: None,
            error_code: None,
            error_message: None,
            warnings: Vec::new(),
            window_index: None,
            window_count: None,
        }
    }

    pub fn set_job_id(&mut self, job_id: &str) {
        self.job_id = Some(job_id.to_string());
    }

    pub fn set_window_progress(&mut self, index: u32, total: u32) {
        self.window_index = Some(index);
        self.window_count = Some(total);
        if let Some(entry) = self.entries.last_mut() {
            if entry.stage == STAGE_TRANSCRIBE {
                entry.segment_index = Some(index);
                entry.segment_total = Some(total);
            }
        }
    }

    /// Windowed sync path: only total is known from warnings, not current index.
    pub fn set_window_count_only(&mut self, total: u32) {
        self.window_count = Some(total);
        if let Some(entry) = self.entries.last_mut() {
            if entry.stage == STAGE_TRANSCRIBE {
                entry.segment_total = Some(total);
            }
        }
    }

    pub fn begin_stage(&mut self, stage: &str) {
        self.close_open_stage(None);
        self.open_stage = Some(stage.to_string());
        self.open_started_ms = Some(now_ms());
    }

    pub fn fail_stage(&mut self, stage: &str, error_code: &str, message: &str) {
        if self.open_stage.as_deref() != Some(stage) {
            self.begin_stage(stage);
        }
        self.close_open_stage(Some(error_code.to_string()));
        self.outcome = Some("failed".to_string());
        self.failed_stage = Some(stage.to_string());
        self.error_code = Some(error_code.to_string());
        self.error_message = Some(message.to_string());
    }

    pub fn finish_success(&mut self, warnings: &[String]) {
        self.close_open_stage(None);
        self.outcome = Some("success".to_string());
        self.warnings = warnings.to_vec();
    }

    pub fn snapshot(&self) -> TranscribeTimelineSnapshot {
        let ended_at_ms = if self.outcome.is_some() {
            Some(now_ms())
        } else {
            None
        };
        let suggested_action = self
            .outcome
            .as_deref()
            .filter(|o| *o == "failed")
            .and_then(|_| {
                suggested_action_for(self.failed_stage.as_deref(), self.error_code.as_deref())
            });
        TranscribeTimelineSnapshot {
            schema_version: 1,
            file_id: self.file_id.clone(),
            source: self.source.clone(),
            job_id: self.job_id.clone(),
            started_at_ms: self.started_at_ms,
            ended_at_ms,
            outcome: self
                .outcome
                .clone()
                .unwrap_or_else(|| "in_progress".to_string()),
            failed_stage: self.failed_stage.clone(),
            error_code: self.error_code.clone(),
            error_message: self.error_message.clone(),
            suggested_action: suggested_action.map(str::to_string),
            transcribe_timeline: self.entries.clone(),
            warnings: self.warnings.clone(),
            window_index: self.window_index,
            window_count: self.window_count,
        }
    }

    pub fn persist(&self, st: &DbState) -> Result<(), String> {
        persist_timeline_at(&last_timeline_path(&st.root), &self.snapshot())
    }

    fn close_open_stage(&mut self, error_code: Option<String>) {
        let Some(stage) = self.open_stage.take() else {
            return;
        };
        let started = self.open_started_ms.take().unwrap_or_else(now_ms);
        self.entries.push(TranscribeTimelineEntry {
            stage,
            started_at_ms: started,
            ended_at_ms: Some(now_ms()),
            error_code,
            segment_index: self.window_index,
            segment_total: self.window_count,
        });
    }
}

pub fn infer_transcribe_error_code(message: &str) -> &'static str {
    let lower = message.to_ascii_lowercase();
    if lower.contains("音频文件缺失") || lower.contains("没有关联音频") {
        return "audio_missing";
    }
    if lower.contains("无法连接本机 asr") || lower.contains("8741") && lower.contains("拒绝")
    {
        return "sidecar_connect";
    }
    if lower.contains("请求超时") || lower.contains("timeout") {
        return "sidecar_timeout";
    }
    if lower.contains("侧车可能已崩溃") || lower.contains("error sending request") {
        return "sidecar_crash";
    }
    if lower.contains("未就绪") || lower.contains("stub") || lower.contains("一键准备") {
        return "preflight_not_ready";
    }
    if lower.contains("规范化失败") || lower.contains("ffmpeg") {
        return "normalize_failed";
    }
    if lower.contains("funasr") || lower.contains("推理失败") {
        return "asr_inference";
    }
    if lower.contains("asr 返回错误") || lower.contains("asr http") {
        return "asr_payload";
    }
    "transcribe_failed"
}

pub fn infer_failed_stage_from_message(message: &str) -> &'static str {
    let lower = message.to_ascii_lowercase();
    if lower.contains("未就绪")
        || lower.contains("stub")
        || lower.contains("ffmpeg_ok")
        || lower.contains("模型尚未就绪")
        || lower.contains("侧车版本过旧")
    {
        return STAGE_PREFLIGHT;
    }
    if lower.contains("规范化失败") {
        return STAGE_UPLOAD;
    }
    if lower.contains("写库") || lower.contains("保存") {
        return STAGE_SAVE;
    }
    STAGE_TRANSCRIBE
}

pub fn suggested_action_for(
    failed_stage: Option<&str>,
    error_code: Option<&str>,
) -> Option<&'static str> {
    match failed_stage.unwrap_or(STAGE_TRANSCRIBE) {
        STAGE_PREFLIGHT => Some(
            "请到「环境 → 本机 ASR」执行一键准备，或确认所选模型已下载并侧车已就绪。",
        ),
        STAGE_UPLOAD => Some("请检查音频文件是否损坏或过长；可在外部转成较短片段后重试。"),
        STAGE_SAVE => Some("转写结果解析成功但写库失败；请重试拉取语段，必要时重启应用。"),
        _ => match error_code.unwrap_or("transcribe_failed") {
            "sidecar_connect" | "sidecar_crash" | "sidecar_timeout" => Some(
                "侧车可能未启动或已崩溃；请到「环境 → 本机 ASR」重试内置侧车，关闭占内存应用后重试。",
            ),
            "asr_inference" => Some(
                "长音频易触发内存不足；请关闭其他占内存应用，或换 Paraformer 长音频模型后重试。",
            ),
            "preflight_not_ready" => Some(
                "请到「环境 → 本机 ASR」完成模型准备后再转写。",
            ),
            _ => Some("请稍后重试；若反复失败，导出诊断包并检查 transcribe_timeline.json。"),
        },
    }
}

#[allow(dead_code)]
pub fn stage_label_zh(stage: &str) -> &'static str {
    match stage {
        STAGE_PREFLIGHT => "准备",
        STAGE_UPLOAD => "上传",
        STAGE_TRANSCRIBE => "转写",
        STAGE_SAVE => "保存",
        _ => "未知阶段",
    }
}

fn last_timeline_path(root: &Path) -> PathBuf {
    root.join("transcribe_timeline_last.json")
}

pub fn persist_timeline_at(path: &Path, snap: &TranscribeTimelineSnapshot) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = serde_json::to_vec_pretty(snap).map_err(|e| e.to_string())?;
    fs::write(path, bytes).map_err(|e| format!("无法写入转写时间线: {e}"))
}

pub fn load_last_timeline(root: &Path) -> Option<TranscribeTimelineSnapshot> {
    let path = last_timeline_path(root);
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn store_active_timeline(job_id: &str, recorder: TranscribeTimelineRecorder) {
    if let Ok(mut guard) = ACTIVE_TIMELINE.lock() {
        *guard = Some((job_id.to_string(), recorder));
    }
}

pub fn take_active_timeline(job_id: &str) -> Option<TranscribeTimelineRecorder> {
    let mut guard = ACTIVE_TIMELINE.lock().ok()?;
    match guard.as_ref() {
        Some((id, _)) if id == job_id => guard.take().map(|(_, r)| r),
        _ => None,
    }
}

fn with_active_timeline<F, R>(job_id: &str, f: F) -> Option<R>
where
    F: FnOnce(&mut TranscribeTimelineRecorder) -> R,
{
    let mut guard = ACTIVE_TIMELINE.lock().ok()?;
    match guard.as_mut() {
        Some((id, rec)) if id == job_id => Some(f(rec)),
        _ => None,
    }
}

pub fn update_active_timeline_progress(
    st: &DbState,
    job_id: &str,
    window_index: u32,
    window_count: u32,
) -> Result<(), String> {
    with_active_timeline(job_id, |rec| {
        rec.set_window_progress(window_index, window_count);
        rec.persist(st)
    })
    .unwrap_or(Ok(()))
}

pub fn fail_and_persist_active_timeline(
    st: &DbState,
    job_id: &str,
    message: &str,
) -> Result<(), String> {
    let Some(mut rec) = take_active_timeline(job_id) else {
        return Ok(());
    };
    if rec.snapshot().outcome != "failed" {
        let stage = infer_failed_stage_from_message(message);
        let code = infer_transcribe_error_code(message);
        rec.fail_stage(stage, code, message);
    }
    rec.persist(st)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeline_serializes_transcribe_timeline_array() {
        let mut rec = TranscribeTimelineRecorder::new("f1", "local");
        rec.begin_stage(STAGE_PREFLIGHT);
        rec.begin_stage(STAGE_TRANSCRIBE);
        rec.fail_stage(STAGE_TRANSCRIBE, "sidecar_connect", "无法连接本机 ASR");
        let snap = rec.snapshot();
        assert_eq!(snap.outcome, "failed");
        assert_eq!(snap.failed_stage.as_deref(), Some(STAGE_TRANSCRIBE));
        assert_eq!(snap.transcribe_timeline.len(), 2);
        assert!(snap.suggested_action.is_some());
        let json = serde_json::to_value(&snap).expect("json");
        assert!(json.get("transcribe_timeline").unwrap().is_array());
    }

    #[test]
    fn infer_error_code_maps_sidecar_connect() {
        let code = infer_transcribe_error_code("无法连接本机 ASR（127.0.0.1:8741 拒绝连接）");
        assert_eq!(code, "sidecar_connect");
    }

    #[test]
    fn suggested_action_preflight() {
        let action = suggested_action_for(Some(STAGE_PREFLIGHT), None);
        assert!(action.unwrap().contains("一键准备"));
    }

    #[test]
    fn set_window_count_only_does_not_set_index() {
        let mut rec = TranscribeTimelineRecorder::new("f1", "local");
        rec.begin_stage(STAGE_TRANSCRIBE);
        rec.set_window_count_only(4);
        let snap = rec.snapshot();
        assert_eq!(snap.window_count, Some(4));
        assert_eq!(snap.window_index, None);
        rec.begin_stage(STAGE_SAVE);
        let snap = rec.snapshot();
        let entry = snap
            .transcribe_timeline
            .iter()
            .find(|e| e.stage == STAGE_TRANSCRIBE)
            .expect("transcribe entry");
        assert_eq!(entry.segment_total, Some(4));
        assert_eq!(entry.segment_index, None);
    }

    #[test]
    fn persist_and_load_sidecar_failure_roundtrip() {
        let dir = std::env::temp_dir().join(format!(
            "rushi-trn-diag-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let mut rec = TranscribeTimelineRecorder::new("file-live", "local");
        rec.begin_stage(STAGE_PREFLIGHT);
        rec.begin_stage(STAGE_TRANSCRIBE);
        rec.fail_stage(
            STAGE_TRANSCRIBE,
            "sidecar_connect",
            "无法连接本机 ASR（127.0.0.1:8741 拒绝连接）",
        );
        let snap = rec.snapshot();
        persist_timeline_at(&last_timeline_path(&dir), &snap).expect("persist");
        let loaded = load_last_timeline(&dir).expect("load");
        let _ = fs::remove_dir_all(&dir);
        assert_eq!(loaded.outcome, "failed");
        assert_eq!(loaded.failed_stage.as_deref(), Some(STAGE_TRANSCRIBE));
        assert_eq!(loaded.error_code.as_deref(), Some("sidecar_connect"));
        assert_eq!(loaded.transcribe_timeline.len(), 2);
        let export_bytes = serde_json::to_vec_pretty(&loaded).expect("export json");
        let export_json: serde_json::Value = serde_json::from_slice(&export_bytes).expect("parse");
        assert!(export_json.get("transcribe_timeline").unwrap().is_array());
        assert_eq!(
            stage_label_zh(loaded.failed_stage.as_deref().unwrap_or("")),
            "转写"
        );
    }

    #[test]
    fn diagnostic_export_timeline_json_contract() {
        let mut rec = TranscribeTimelineRecorder::new("file-abc", "local");
        rec.set_job_id("job-1");
        rec.begin_stage(STAGE_PREFLIGHT);
        rec.begin_stage(STAGE_TRANSCRIBE);
        rec.set_window_progress(2, 5);
        rec.fail_stage(STAGE_TRANSCRIBE, "sidecar_timeout", "请求超时");
        let snap = rec.snapshot();
        let json = serde_json::to_value(&snap).expect("json");
        assert_eq!(json.get("schemaVersion").and_then(|v| v.as_u64()), Some(1));
        assert_eq!(
            json.get("fileId").and_then(|v| v.as_str()),
            Some("file-abc")
        );
        assert_eq!(json.get("jobId").and_then(|v| v.as_str()), Some("job-1"));
        assert_eq!(json.get("outcome").and_then(|v| v.as_str()), Some("failed"));
        let timeline = json
            .get("transcribe_timeline")
            .expect("transcribe_timeline");
        assert!(timeline.is_array());
        assert_eq!(timeline.as_array().unwrap().len(), 2);
        assert!(json.get("suggestedAction").is_some());
    }
}

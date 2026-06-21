//! Progress emission for bundled ASR models seed.

use tauri::{AppHandle, Emitter};

use super::BundledAsrModelsSeedProgressPayload;

pub fn emit_progress(app: Option<&AppHandle>, phase: &str, copied_bytes: u64, total_bytes: u64) {
    let Some(app) = app else {
        return;
    };
    let percent = copied_bytes
        .checked_mul(100)
        .and_then(|scaled| scaled.checked_div(total_bytes))
        .map(|p| p.min(100) as u8)
        .unwrap_or(0);
    let _ = app.emit(
        super::BUNDLED_ASR_MODELS_SEED_PROGRESS_EVENT,
        BundledAsrModelsSeedProgressPayload {
            phase: phase.to_string(),
            copied_bytes,
            total_bytes,
            percent,
        },
    );
}

pub fn log_seed_detail(app: Option<&AppHandle>, detail: &str) {
    let Some(app) = app else {
        return;
    };
    let _ = app.emit("bundled-asr-models-seed-log", detail.to_string());
}

//! R3h-I4 ASR-WARM: keepalive via persistent child, model warmup, idle recycle.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::Duration;

use tauri::AppHandle;

use crate::blocking_http::loopback_post_ok;

use super::supervisor::{self, SupervisorPhase};
use super::{app_manages_bundled_sidecar, stop_bundled};

static GLOBAL_ACTIVITY_MS: AtomicU64 = AtomicU64::new(0);
static TRANSCRIBE_IN_FLIGHT: AtomicU32 = AtomicU32::new(0);

const WARMUP_URL: &str = "http://127.0.0.1:8741/v1/models/warmup";
const DEFAULT_WATCHDOG_SEC: u64 = 30;
const DEFAULT_IDLE_STOP_SEC: u64 = 900;
const WARMUP_TIMEOUT_SEC: u64 = 600;

pub fn touch_global_activity_ms() {
    GLOBAL_ACTIVITY_MS.store(supervisor::now_ms(), Ordering::Relaxed);
}

pub fn inc_transcribe_in_flight() {
    TRANSCRIBE_IN_FLIGHT.fetch_add(1, Ordering::Relaxed);
    touch_global_activity_ms();
}

pub fn dec_transcribe_in_flight() {
    let prev = TRANSCRIBE_IN_FLIGHT.fetch_sub(1, Ordering::Relaxed);
    if prev == 0 {
        TRANSCRIBE_IN_FLIGHT.store(0, Ordering::Relaxed);
    }
    touch_global_activity_ms();
}

pub fn transcribe_in_flight() -> bool {
    TRANSCRIBE_IN_FLIGHT.load(Ordering::Relaxed) > 0
}

fn activity_ms(handle: &AppHandle) -> u64 {
    let snap = supervisor::snapshot(handle);
    let global = GLOBAL_ACTIVITY_MS.load(Ordering::Relaxed);
    snap.last_activity_ms.max(global)
}

pub fn warmup_enabled() -> bool {
    std::env::var("RUSHI_ASR_WARMUP")
        .ok()
        .as_deref()
        .map(|v| v != "0" && !v.eq_ignore_ascii_case("false"))
        .unwrap_or(true)
}

pub fn watchdog_enabled() -> bool {
    std::env::var("RUSHI_ASR_WATCHDOG")
        .ok()
        .as_deref()
        .map(|v| v != "0" && !v.eq_ignore_ascii_case("false"))
        .unwrap_or(true)
}

fn idle_stop_secs() -> u64 {
    std::env::var("RUSHI_ASR_IDLE_STOP_SEC")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_IDLE_STOP_SEC)
}

fn watchdog_interval_secs() -> u64 {
    std::env::var("RUSHI_ASR_WATCHDOG_SEC")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_WATCHDOG_SEC)
}

pub fn post_model_warmup_sync() -> Result<(), String> {
    if !warmup_enabled() {
        return Ok(());
    }
    let token = super::local_token::resolve_local_token_for_request();
    let headers: Vec<(&str, &str)> = match token.as_deref() {
        Some(t) => vec![(super::local_token::TOKEN_HEADER, t)],
        None => vec![],
    };
    loopback_post_ok(WARMUP_URL, WARMUP_TIMEOUT_SEC, &headers)
}

fn run_warmup_once(handle: &AppHandle) {
    if !warmup_enabled() {
        return;
    }
    let snap = supervisor::snapshot(handle);
    if snap.warmup_completed {
        return;
    }
    match post_model_warmup_sync() {
        Ok(()) => {
            super::bundled::launch::append_sidecar_log_line(handle, "INFO asr_warmup_ok");
            supervisor::note_warmup_done(handle);
        }
        Err(e) => {
            supervisor::note_error(handle, "asr_warmup_failed");
            super::bundled::launch::append_sidecar_log_line(
                handle,
                &format!("WARN asr_warmup_failed {e}"),
            );
        }
    }
}

/// Fire-and-forget warmup so bundled launch is not blocked for minutes.
pub fn spawn_warmup_on_ready(handle: &AppHandle) {
    if !warmup_enabled() {
        return;
    }
    let snap = supervisor::snapshot(handle);
    if snap.warmup_completed {
        return;
    }
    let h = handle.clone();
    tauri::async_runtime::spawn(async move {
        let hh = h.clone();
        let _ = tauri::async_runtime::spawn_blocking(move || run_warmup_once(&hh)).await;
    });
}

fn maybe_idle_stop(handle: &AppHandle) {
    let idle_sec = idle_stop_secs();
    if idle_sec == 0 || !app_manages_bundled_sidecar() || transcribe_in_flight() {
        return;
    }
    let snap = supervisor::snapshot(handle);
    if snap.phase != SupervisorPhase::Ready {
        return;
    }
    let elapsed_ms = supervisor::now_ms().saturating_sub(activity_ms(handle));
    if elapsed_ms < idle_sec.saturating_mul(1000) {
        return;
    }
    super::bundled::launch::append_sidecar_log_line(
        handle,
        &format!("INFO asr_idle_stop after_idle_sec={idle_sec}"),
    );
    stop_bundled(handle);
    supervisor::set_phase(handle, SupervisorPhase::Stopped);
}

pub fn watchdog_tick(handle: &AppHandle) {
    if !watchdog_enabled() {
        return;
    }
    if !supervisor::watchdog_tick(handle) {
        return;
    }
    supervisor::refresh_health_flags(handle);
    maybe_idle_stop(handle);
}

pub fn spawn_watchdog(handle: AppHandle) {
    if !watchdog_enabled() {
        return;
    }
    let interval = watchdog_interval_secs().max(5);
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(interval)).await;
            let h = handle.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || watchdog_tick(&h)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn warmup_enabled_by_default() {
        std::env::remove_var("RUSHI_ASR_WARMUP");
        assert!(warmup_enabled());
    }

    #[test]
    fn transcribe_in_flight_guard() {
        while transcribe_in_flight() {
            dec_transcribe_in_flight();
        }
        assert!(!transcribe_in_flight());
        inc_transcribe_in_flight();
        assert!(transcribe_in_flight());
        dec_transcribe_in_flight();
        assert!(!transcribe_in_flight());
    }
}

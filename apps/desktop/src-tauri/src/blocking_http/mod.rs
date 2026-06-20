//! Blocking HTTP helpers — **only** inside `tauri::async_runtime::spawn_blocking` workers.
//!
//! ## Policy (R-10 / Sprint D4)
//! - Tauri `#[tauri::command]` handlers must **not** call `reqwest::blocking` or functions in this module directly.
//! - Sidecar loopback reads from commands: prefer `spawn_blocking` + `loopback_get_json` / `loopback_get_text`.
//! - Long probes (STT/LLM health): use `stt_probe_blocking_client` / `llm_probe_blocking_client` from a blocking task.
//! - ASR port classify (`asr_sidecar::probe::probe_asr_port_and_health`) uses async `reqwest` — keep off the blocking pool.
//!
//! Call sites: `stt_online_probe`, installer verify, `asr_sidecar::probe` sync helpers via loopback_* only.

mod llm_probe;
mod loopback;
mod stt_probe;
mod xunfei_ost_probe;

pub use llm_probe::llm_probe_blocking_client;
pub use loopback::{loopback_get_json, loopback_get_send, loopback_get_text, loopback_post_ok};
pub use reqwest::blocking::{Client as BlockingClient, Response as BlockingResponse};
pub use stt_probe::stt_probe_blocking_client;
pub use xunfei_ost_probe::{send_ost_credentials_probe, XunfeiOstProbeTransport};

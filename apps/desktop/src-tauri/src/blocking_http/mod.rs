//! Blocking HTTP helpers — only for `spawn_blocking` / installer verify workers.
//! Do not call from Tauri command threads directly.

mod llm_probe;
mod loopback;
mod stt_probe;

pub use llm_probe::llm_probe_blocking_client;
pub use loopback::{loopback_get_json, loopback_get_text};
pub use stt_probe::stt_probe_blocking_client;
pub use reqwest::blocking::{Client as BlockingClient, Response as BlockingResponse};

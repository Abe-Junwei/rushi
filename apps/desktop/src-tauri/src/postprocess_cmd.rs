#[path = "postprocess_probe.rs"]
mod postprocess_probe;
#[path = "postprocess_secret_store.rs"]
mod postprocess_secret_store;
#[path = "postprocess_ollama.rs"]
mod postprocess_ollama;
#[path = "postprocess_segment_ops.rs"]
mod postprocess_segment_ops;
#[path = "postprocess_export_polish.rs"]
mod postprocess_export_polish;
#[path = "postprocess_export_polish_cmd.rs"]
pub mod postprocess_export_polish_cmd;
#[path = "postprocess_config.rs"]
mod postprocess_config;
#[path = "postprocess_api_key_cmd.rs"]
pub mod postprocess_api_key_cmd;
#[path = "postprocess_types.rs"]
mod postprocess_types;
#[path = "postprocess_cancel_cmd.rs"]
pub mod postprocess_cancel_cmd;
#[path = "postprocess_auto_punctuate_cmd.rs"]
pub mod postprocess_auto_punctuate_cmd;
#[path = "postprocess_refine_cmd.rs"]
pub mod postprocess_refine_cmd;

pub(crate) use postprocess_config::{
    build_auto_punctuate_prompt, build_postprocess_models_endpoint, chat_completion_finish_reason,
    extract_chat_completion_text, resolve_postprocess_config_async, resolve_runtime_postprocess_config,
    PostprocessConfig, DEFAULT_TIMEOUT_SECS,
};

#[cfg(test)]
pub(crate) use postprocess_api_key_cmd::{secret_account_for_delete, LlmSaveApiKeyRequest};
#[cfg(test)]
pub(crate) use postprocess_config::{
    normalize_api_key_id, parse_postprocess_endpoint, resolve_postprocess_config,
};

pub use postprocess_types::*;

#[cfg(test)]
#[path = "postprocess_cmd_tests.rs"]
mod tests;

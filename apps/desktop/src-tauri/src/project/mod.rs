//! Local project persistence, ASR pull, segment CRUD, edit log.
//! P2: segment confidence / low_confidence / detail; local glossary_terms.

pub mod app_data_paths;
pub mod asr_cache_cmd;
pub mod asr_runtime_paths_cmd;
pub mod correction;
pub mod correction_memory_cmd;
mod edit_log_detail;
mod edit_log_snapshot;
pub mod export_cmd;
pub mod file_cmd;
pub mod glossary_aliases;
pub mod glossary_bulk_parse;
pub mod glossary_cmd;
pub mod glossary_hotwords;
pub mod hotword_guard;
pub mod glossary_import;
pub mod glossary_insert;
pub mod glossary_structured_import;
pub mod import_parse;
pub mod install_cmd;
pub mod lexicon_bundle;
pub mod lexicon_bundle_cmd;
pub mod lexicon_pack;
mod local_transcribe_gate;
pub mod picker_cmd;
mod project_bundle_cmd;
pub mod project_create_cmd;
pub mod project_delete_cmd;
pub mod project_query_cmd;
pub mod project_storage;
pub mod run_transcribe_cmd;
pub mod segment_cmd;
mod segment_media_sanitize;
mod segment_uid;
pub mod stt_vocabulary;
pub mod transcribe;
mod transcribe_errors;
mod transcribe_job;
mod transcribe_native_online;
mod transcribe_response;
mod transcribe_timeout;
pub mod types;
pub mod utils;
pub mod waveform_peaks;
pub mod waveform_peaks_cache_cmd;
pub mod waveform_peaks_cmd;
pub mod waveform_peaks_ffmpeg;
pub mod waveform_peaks_gc;
pub mod waveform_peaks_generate;

pub use app_data_paths::models_root_for_app_data_root;
pub use asr_cache_cmd::*;
pub use asr_runtime_paths_cmd::*;
pub use correction_memory_cmd::*;
pub use lexicon_bundle_cmd::*;
pub use export_cmd::*;
pub use file_cmd::*;
pub use glossary_cmd::*;
pub use install_cmd::*;
pub use picker_cmd::*;
pub use project_create_cmd::*;
pub use project_delete_cmd::*;
pub use project_query_cmd::*;
pub use run_transcribe_cmd::*;
pub use segment_cmd::*;
pub use types::*;
pub use waveform_peaks_cache_cmd::*;
pub use waveform_peaks_cmd::*;

#[cfg(test)]
mod cmd_integration_tests;
#[cfg(test)]
mod project_bundle_cmd_tests;
#[cfg(test)]
mod segment_cmd_tests;

use rusqlite::Connection;
use std::fs;
use tauri::Manager;

use self::utils::append_desktop_log_line;
use crate::db;
use crate::DbState;

/// One-shot DB bootstrap (migrations + WAL, idempotent).
pub fn setup_db(app: &tauri::AppHandle) -> Result<DbState, String> {
    let resolver = app.path();
    let app_data = resolver.app_data_dir().map_err(|e| e.to_string())?;
    let base = app_data_paths::resolve_app_data_root(app_data);
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

#[cfg(test)]
mod app_data_root_tests {
    use super::app_data_paths::resolve_app_data_root;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn prefers_legacy_nested_root_when_sqlite_there() {
        let temp = std::env::temp_dir().join(format!("rushi-app-data-{}", Uuid::new_v4()));
        let legacy = temp.join("studio.lingchuang.rushi");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("rushi.sqlite3"), b"").unwrap();
        assert_eq!(resolve_app_data_root(temp.clone()), legacy);
        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn prefers_legacy_nested_root_when_models_exist() {
        let temp = std::env::temp_dir().join(format!("rushi-app-data-{}", Uuid::new_v4()));
        let legacy = temp.join("studio.lingchuang.rushi");
        fs::create_dir_all(legacy.join("models")).unwrap();
        assert_eq!(resolve_app_data_root(temp.clone()), legacy);
        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn uses_flat_app_data_when_no_legacy_db() {
        let temp = std::env::temp_dir().join(format!("rushi-app-data-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        assert_eq!(resolve_app_data_root(temp.clone()), temp);
        let _ = fs::remove_dir_all(&temp);
    }
}

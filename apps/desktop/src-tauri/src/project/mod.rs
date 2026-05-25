//! Local project persistence, ASR pull, segment CRUD, edit log.
//! P2: segment confidence / low_confidence / detail; local glossary_terms.

pub mod asr_cache_cmd;
pub mod correction;
pub mod export_cmd;
pub mod file_cmd;
pub mod glossary_cmd;
pub mod import_parse;
pub mod install_cmd;
pub mod picker_cmd;
mod project_bundle_cmd;
pub mod project_create_cmd;
pub mod project_delete_cmd;
pub mod project_query_cmd;
pub mod run_transcribe_cmd;
pub mod segment_cmd;
mod segment_uid;
pub mod transcribe;
mod transcribe_native_online;
pub mod types;
pub mod utils;

pub use asr_cache_cmd::*;
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

#[cfg(test)]
mod cmd_integration_tests;
#[cfg(test)]
mod project_bundle_cmd_tests;
#[cfg(test)]
mod segment_cmd_tests;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use self::utils::append_desktop_log_line;
use crate::db;
use crate::DbState;

/// `app_data_dir()` 已含 bundle id（`studio.lingchuang.rushi`）；旧版误再拼一层，若该处已有 DB 则继续用嵌套路径。
fn resolve_app_data_root(app_data: PathBuf) -> PathBuf {
    let legacy = app_data.join("studio.lingchuang.rushi");
    if legacy.join("rushi.sqlite3").is_file() {
        return legacy;
    }
    app_data
}

/// One-shot DB bootstrap (migrations + WAL, idempotent).
pub fn setup_db(app: &tauri::AppHandle) -> Result<DbState, String> {
    let resolver = app.path();
    let app_data = resolver.app_data_dir().map_err(|e| e.to_string())?;
    let base = resolve_app_data_root(app_data);
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
    use super::resolve_app_data_root;
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
    fn uses_flat_app_data_when_no_legacy_db() {
        let temp = std::env::temp_dir().join(format!("rushi-app-data-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        assert_eq!(resolve_app_data_root(temp.clone()), temp);
        let _ = fs::remove_dir_all(&temp);
    }
}

//! Local project persistence, ASR pull, segment CRUD, edit log.
//! P2: segment confidence / low_confidence / detail; local glossary_terms.

pub mod correction;
pub mod export_cmd;
pub mod glossary_cmd;
pub mod install_cmd;
pub mod project_cmd;
pub mod run_transcribe_cmd;
pub mod transcribe;
pub mod types;
pub mod utils;

pub use export_cmd::*;
pub use glossary_cmd::*;
pub use install_cmd::*;
pub use project_cmd::*;
pub use run_transcribe_cmd::*;
pub use types::*;

use rusqlite::Connection;
use std::fs;
use tauri::Manager;

use self::utils::append_desktop_log_line;
use crate::db;
use crate::DbState;

/// One-shot DB bootstrap (migrations + WAL, idempotent).
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

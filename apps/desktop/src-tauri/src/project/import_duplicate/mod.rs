mod backfill;
mod check;
mod hash;
mod path_meta;
mod types;

#[cfg(test)]
mod tests;

pub use backfill::backfill_files_import_provenance;
pub use check::check_import_duplicate_inner;
pub use path_meta::{import_file_display_name, import_provenance_for_src, ImportFileKind};
pub use types::ImportDuplicateCheck;

use crate::DbState;
use std::ops::Deref;
use tauri::State;

use super::utils::open_db;

#[tauri::command]
pub fn check_project_import_duplicate(
    state: State<DbState>,
    project_id: String,
    src_path: String,
    replace_target_file_id: Option<String>,
) -> Result<ImportDuplicateCheck, String> {
    let st: &DbState = state.deref();
    let conn = open_db(st)?;
    check_import_duplicate_inner(
        &conn,
        &project_id,
        &src_path,
        replace_target_file_id.as_deref(),
    )
}

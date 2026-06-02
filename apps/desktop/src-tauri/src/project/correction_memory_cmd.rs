use super::correction::{
    delete_correction_memory_entry, list_correction_memory_entries, list_glossary_mine_candidates,
    save_correction_memory_entry, CorrectionMemoryEntryRow, GlossaryLearnPromptRow,
};
use super::utils::open_db;
use crate::DbState;
use std::ops::Deref;
use tauri::State;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionMemorySavePayload {
    pub wrong: String,
    pub right: String,
    pub accepted_as_rule: bool,
    pub replace_wrong: Option<String>,
    pub replace_right: Option<String>,
}

#[tauri::command]
pub fn correction_memory_list(state: State<DbState>) -> Result<Vec<CorrectionMemoryEntryRow>, String> {
    let conn = open_db(state.deref())?;
    list_correction_memory_entries(&conn)
}

#[tauri::command]
pub fn correction_memory_save(
    state: State<DbState>,
    payload: CorrectionMemorySavePayload,
) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    save_correction_memory_entry(
        &conn,
        &payload.wrong,
        &payload.right,
        payload.accepted_as_rule,
        payload.replace_wrong.as_deref(),
        payload.replace_right.as_deref(),
    )
}

#[tauri::command]
pub fn correction_glossary_mine_candidates(
    state: State<DbState>,
) -> Result<Vec<GlossaryLearnPromptRow>, String> {
    let conn = open_db(state.deref())?;
    list_glossary_mine_candidates(&conn)
}

#[tauri::command]
pub fn correction_memory_delete(
    state: State<DbState>,
    wrong: String,
    right: String,
) -> Result<(), String> {
    let conn = open_db(state.deref())?;
    delete_correction_memory_entry(&conn, &wrong, &right)
}

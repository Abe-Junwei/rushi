use super::lexicon_bundle::{
    apply_lexicon_bundle_import, build_lexicon_bundle_export, build_lexicon_bundle_export_preview,
    parse_lexicon_bundle_json, preview_lexicon_bundle_import, serialize_lexicon_bundle,
    LexiconBundleConflictResolution, LexiconBundleImportApplyResult, LexiconBundleImportPreview,
};
use super::utils::open_db;
use crate::command_error::CommandError;
use crate::DbState;
use std::fs;
use std::ops::Deref;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LexiconBundleImportPreviewResult {
    pub preview: LexiconBundleImportPreview,
    pub bundle_json: String,
}

#[tauri::command]
pub fn lexicon_bundle_export_preview(
    state: State<DbState>,
    stable_only: bool,
) -> Result<super::lexicon_bundle::LexiconBundleExportPreview, String> {
    let conn = open_db(state.deref())?;
    build_lexicon_bundle_export_preview(&conn, stable_only)
}

#[tauri::command]
pub async fn lexicon_bundle_export(
    state: State<'_, DbState>,
    stable_only: bool,
    optional_label: Option<String>,
) -> Result<Option<String>, String> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
        let conn = open_db(&st)?;
        let doc = build_lexicon_bundle_export(&conn, stable_only, optional_label)?;
        let content = serialize_lexicon_bundle(&doc)?;
        let picked = rfd::FileDialog::new()
            .add_filter("JSON", &["json"])
            .set_file_name("rushi-lexicon-bundle.json")
            .save_file();
        let Some(path) = picked else {
            return Ok(None);
        };
        if path.exists() {
            return Err(CommandError::TargetFileExists.to_string());
        }
        fs::write(&path, content).map_err(|e| CommandError::WriteLexiconBundle(e).to_string())?;
        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| {
        CommandError::ExportLexiconBundle {
            detail: e.to_string(),
        }
        .to_string()
    })?
}

#[tauri::command]
pub async fn lexicon_bundle_import_preview(
    state: State<'_, DbState>,
) -> Result<Option<LexiconBundleImportPreviewResult>, String> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(
        move || -> Result<Option<LexiconBundleImportPreviewResult>, String> {
            let conn = open_db(&st)?;
            let picked = rfd::FileDialog::new()
                .add_filter("JSON", &["json"])
                .pick_file();
            let Some(path) = picked else {
                return Ok(None);
            };
            let raw = fs::read_to_string(&path)
                .map_err(|e| CommandError::ReadLexiconBundle(e).to_string())?;
            let doc = parse_lexicon_bundle_json(&raw)?;
            let preview = preview_lexicon_bundle_import(&conn, &doc)?;
            Ok(Some(LexiconBundleImportPreviewResult {
                preview,
                bundle_json: raw,
            }))
        },
    )
    .await
    .map_err(|e| {
        CommandError::ImportLexiconBundle {
            detail: e.to_string(),
        }
        .to_string()
    })?
}

#[tauri::command]
pub fn lexicon_bundle_import_apply(
    state: State<DbState>,
    bundle_json: String,
    resolutions: Vec<LexiconBundleConflictResolution>,
) -> Result<LexiconBundleImportApplyResult, String> {
    let mut conn = open_db(state.deref())?;
    let doc = parse_lexicon_bundle_json(&bundle_json)?;
    apply_lexicon_bundle_import(&mut conn, &doc, &resolutions)
}

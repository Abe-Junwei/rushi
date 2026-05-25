mod asr_sidecar;
mod china_stt_shell;
mod db;
mod diagnostic;
mod export_docx;
mod online_stt_bridge;
mod postprocess_cmd;
mod profile;
mod project;
mod stt_native;
mod utils;

use std::path::PathBuf;

use tauri::{Manager, RunEvent};

#[derive(Clone)]
pub struct DbState {
    pub root: PathBuf,
    pub db_path: PathBuf,
}

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let st = project::setup_db(app.handle())?;
            app.manage(st);
            app.manage(asr_sidecar::AsrSidecarState(std::sync::Mutex::new(None)));
            app.manage(asr_sidecar::BundledAsrLaunchState(std::sync::Mutex::new(
                asr_sidecar::BundledAsrLaunchReport::default(),
            )));
            app.manage(postprocess_cmd::PostprocessCancelState::default());
            asr_sidecar::try_start_bundled(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            asr_sidecar::bundled_asr_launch_report,
            project::pick_audio_path,
            project::project_create_from_audio,
            project::create_empty_project,
            project::create_project_from_text,
            project::create_empty_text_file,
            project::import_audio_to_project,
            project::import_text_to_project,
            project::project_list,
            project::project_load,
            project::project_list_edit_log,
            project::file_save_segments,
            project::project_run_transcribe,
            project::project_delete,
            project::pick_text_path,
            project::list_files,
            project::load_file,
            project::rename_file,
            project::delete_file,
            project::export_project_bundle,
            project::import_project_bundle,
            project::asr_model_cache_info,
            project::clear_asr_model_cache,
            project::install_funasr_deps_interactive,
            project::retry_bundled_asr_sidecar,
            project::open_app_data_folder,
            project::export_text_file,
            project::glossary_list,
            project::glossary_add,
            project::glossary_delete,
            postprocess_cmd::llm_save_api_key,
            postprocess_cmd::llm_delete_api_key,
            postprocess_cmd::llm_probe_connection,
            postprocess_cmd::postprocess_auto_punctuate,
            postprocess_cmd::postprocess_cancel_auto_punctuate,
            profile::export_settings_profile,
            profile::import_settings_profile,
            export_docx::export_docx,
            diagnostic::export_diagnostic_bundle,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            asr_sidecar::stop_bundled(app_handle);
        }
    });
}

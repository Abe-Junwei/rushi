mod asr_sidecar;
mod china_stt_shell;
mod db;
mod export_docx;
mod online_stt_bridge;
mod p1;
mod p4_diagnostic;
mod stt_native;

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
            let st = p1::setup_db(app.handle())?;
            app.manage(st);
            app.manage(asr_sidecar::AsrSidecarState(std::sync::Mutex::new(None)));
            app.manage(asr_sidecar::BundledAsrLaunchState(std::sync::Mutex::new(
                asr_sidecar::BundledAsrLaunchReport::default(),
            )));
            asr_sidecar::try_start_bundled(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            asr_sidecar::bundled_asr_launch_report,
            p1::p1_pick_audio_path,
            p1::p1_project_create,
            p1::p1_project_list,
            p1::p1_project_load,
            p1::p1_project_save_segments,
            p1::p1_project_run_transcribe,
            p1::p1_project_delete,
            p1::p1_install_funasr_deps_interactive,
            p1::p1_retry_bundled_asr_sidecar,
            p1::p1_open_app_data_folder,
            p1::p1_export_text_file,
            p1::p2_glossary_list,
            p1::p2_glossary_add,
            p1::p2_glossary_delete,
            export_docx::p3_export_docx,
            p4_diagnostic::p4_export_diagnostic_bundle,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            asr_sidecar::stop_bundled(app_handle);
        }
    });
}

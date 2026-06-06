mod asr_setup;
mod asr_sidecar;
mod china_stt_shell;
mod db;
mod diagnostic;
mod diagnostic_db_sanitize;
mod export_docx;
mod export_docx_polish_track;
mod local_asr_language;
mod local_asr_model;
mod local_runtime;
mod online_stt_bridge;
mod postprocess_cmd;
mod profile;
mod project;
mod stt_native;
mod stt_online_probe;
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
            app.manage(local_runtime::installer::LocalRuntimeInstallerState::default());
            app.manage(postprocess_cmd::PostprocessCancelState::default());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = tauri::async_runtime::spawn_blocking(move || {
                    asr_sidecar::try_start_bundled(&handle);
                })
                .await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_version,
            asr_setup::diagnose::asr_setup_diagnose,
            asr_sidecar::bundled::launch::bundled_asr_launch_report,
            local_runtime::local_runtime_diagnose,
            local_runtime::installer::commands::local_runtime_download_sidecar,
            local_runtime::installer::commands::local_runtime_cancel_download,
            local_runtime::recovery::commands::revalidate::local_runtime_revalidate_install,
            local_runtime::recovery::commands::clear::local_runtime_clear_install,
            local_runtime::recovery::commands::restore::local_runtime_restore_previous,
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
            project::project_record_edit_log,
            project::file_save_segments,
            project::file_restore_segments_from_edit_log,
            project::project_run_transcribe,
            project::project_transcribe_async_start,
            project::project_transcribe_async_finalize,
            project::project_delete,
            project::pick_text_path,
            project::list_files,
            project::load_file,
            project::rename_file,
            project::delete_file,
            project::ensure_waveform_peaks,
            project::waveform_peaks_status,
            project::export_project_bundle,
            project::import_project_bundle,
            project::get_asr_runtime_paths,
            project::asr_model_cache_info,
            project::clear_asr_model_cache,
            project::waveform_peaks_cache_info,
            project::clear_orphan_waveform_peaks_cache,
            project::clear_waveform_peaks_for_file,
            project::install_funasr_deps_interactive,
            project::retry_bundled_asr_sidecar,
            asr_sidecar::loopback::asr_loopback_request,
            asr_sidecar::asr_app_manages_bundled_sidecar,
            asr_sidecar::kill_loopback_asr_listeners_cmd,
            local_asr_model::get_local_asr_hub_model_pref,
            local_asr_model::set_local_asr_hub_model_pref,
            local_asr_language::get_local_asr_recognition_language_pref,
            local_asr_language::set_local_asr_recognition_language_pref,
            project::open_app_data_folder,
            project::export_text_file,
            project::glossary_list,
            project::glossary_add,
            project::glossary_add_batch,
            project::glossary_update,
            project::glossary_delete_batch,
            project::glossary_set_hotword_batch,
            project::glossary_delete,
            project::glossary_hotwords_preview,
            project::glossary_import_from_file,
            postprocess_cmd::postprocess_api_key_cmd::llm_save_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_delete_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_has_stored_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_migrate_legacy_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_probe_connection,
            postprocess_cmd::postprocess_api_key_cmd::ollama_detect_status,
            stt_online_probe::stt_probe_online_health,
            postprocess_cmd::postprocess_auto_punctuate_cmd::postprocess_auto_punctuate,
            postprocess_cmd::postprocess_refine_cmd::postprocess_refine_segments,
            postprocess_cmd::postprocess_stage_b_proofread_cmd::postprocess_stage_b_proofread,
            postprocess_cmd::postprocess_cancel_cmd::postprocess_cancel_auto_punctuate,
            postprocess_cmd::postprocess_cancel_cmd::postprocess_cancel_export_polish,
            postprocess_cmd::postprocess_export_polish_cmd::postprocess_export_polish,
            project::correction_accept_rule,
            project::correction_stable_rules_list,
            project::correction_glossary_learn_prompts,
            project::correction_memory_list,
            project::correction_memory_save,
            project::correction_memory_delete,
            project::correction_glossary_mine_candidates,
            project::lexicon_bundle_export,
            project::lexicon_bundle_import_preview,
            project::lexicon_bundle_import_apply,
            profile::export_settings_profile,
            profile::import_settings_profile,
            export_docx::export_docx,
            diagnostic::export_diagnostic_bundle,
            project::quality_eval::quality_get_last_report,
            project::quality_eval::quality_get_baseline_report,
            project::quality_eval::quality_run_eval,
            project::quality_eval::quality_import_report_file,
            project::quality_eval::quality_save_report_from_json,
            project::quality_eval::quality_set_baseline_from_last,
            project::quality_eval::quality_last_report_path_cmd,
            project::quality_eval::quality_export_correction_memory_jsonl,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            asr_sidecar::stop_bundled(app_handle);
        }
    });
}

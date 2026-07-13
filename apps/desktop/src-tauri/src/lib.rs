mod app_info;
mod asr_setup;
mod asr_sidecar;
mod blocking_http;
mod bundled_asr_assets;
mod command_error;
mod db;
mod diagnostic;
mod diagnostic_db_sanitize;
mod export_docx;
mod export_docx_polish_track;
mod local_asr_language;
mod local_asr_model;
mod local_runtime;
mod native_audio;
mod online_stt_bridge;
mod packaged_hints;
mod postprocess_cmd;
mod profile;
mod project;
mod secret_keyring_session;
mod secret_store_policy;
mod stt_native;
mod stt_online_api_key_cmd;
mod stt_online_probe;
mod stt_online_secret_store;
mod utils;

use std::path::PathBuf;
use std::sync::Arc;

use tauri::{Manager, RunEvent};

use crate::db::DbPool;

#[derive(Clone)]
pub struct DbState {
    pub root: PathBuf,
    pub db_path: PathBuf,
    pool: Arc<DbPool>,
}

impl DbState {
    pub fn new(root: PathBuf, db_path: PathBuf, pool: DbPool) -> Self {
        Self {
            root,
            db_path,
            pool: Arc::new(pool),
        }
    }

    pub(crate) fn pool(&self) -> &DbPool {
        &self.pool
    }

    #[cfg(test)]
    pub fn open_test_db(root: PathBuf) -> Self {
        Self::open_test_db_at(root.clone(), root.join("rushi.sqlite3"))
    }

    #[cfg(test)]
    pub fn open_test_db_at(root: PathBuf, db_path: PathBuf) -> Self {
        let pool = crate::db::bootstrap_db_at(&db_path).expect("test db bootstrap");
        Self::new(root, db_path, pool)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            bundled_asr_assets::init_from_app(app.handle());
            let st = project::setup_db(app.handle())?;
            let build_info = app_info::build_app_build_info(Some(&st.root), Some(&st.db_path));
            project::utils::append_desktop_log_line(
                &st,
                &format!(
                    "INFO parity startup: profile={} platform={}-{}",
                    build_info.shell_profile, build_info.platform_os, build_info.platform_arch
                ),
            );
            project::utils::append_desktop_log_line(
                &st,
                &format!(
                    "INFO parity bundle: asr_shell_managed={} bundled_sidecar_build={}",
                    build_info.asr_shell_managed,
                    if build_info.bundled_sidecar_build.is_some() {
                        "present"
                    } else {
                        "missing"
                    }
                ),
            );
            let automation_diag_state = st.clone();
            app.manage(st);
            #[cfg(feature = "devtools")]
            if std::env::var_os("RUSHI_DEVTOOLS").is_some() {
                if let Some(w) = app.get_webview_window("main") {
                    w.open_devtools();
                }
            }
            app.manage(asr_sidecar::AsrSidecarState(std::sync::Mutex::new(None)));
            app.manage(asr_sidecar::BundledAsrLaunchState(std::sync::Mutex::new(
                asr_sidecar::BundledAsrLaunchReport::default(),
            )));
            app.manage(asr_sidecar::AsrSupervisorState(std::sync::Mutex::new(
                asr_sidecar::supervisor::SupervisorSnapshot::new_session(),
            )));
            app.manage(local_runtime::installer::LocalRuntimeInstallerState::default());
            app.manage(postprocess_cmd::PostprocessCancelState::default());
            app.manage(project::TranscribeCancelState::default());
            app.manage(native_audio::NativeAudioState::default());
            if std::env::var_os("RUSHI_AUTOMATION").as_deref() == Some(std::ffi::OsStr::new("1"))
                && std::env::var_os("RUSHI_AUTOMATION_DIAGNOSTIC_ZIP").is_some()
            {
                let path = std::env::var_os("RUSHI_AUTOMATION_DIAGNOSTIC_ZIP").unwrap();
                let diag_handle = app.handle().clone();
                let diag_state = automation_diag_state.clone();
                let diag_path = PathBuf::from(path);
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(20)).await;
                    let diag_state_for_log = diag_state.clone();
                    let diag_path_for_log = diag_path.clone();
                    let result = tauri::async_runtime::spawn_blocking(move || {
                        diagnostic::write_diagnostic_bundle_to_path(
                            &diag_handle,
                            &diag_state,
                            &diag_path,
                        )
                    })
                    .await
                    .unwrap_or_else(|e| Err(format!("diagnostic task join failed: {e}")));
                    let line = match result {
                        Ok(()) => format!(
                            "INFO parity startup: automation_diagnostic_zip=ok path={}",
                            diag_path_for_log.display()
                        ),
                        Err(e) => format!(
                            "WARN parity startup: automation_diagnostic_zip=failed err={}",
                            e.replace(['\n', '\r'], " ")
                        ),
                    };
                    project::utils::append_desktop_log_line(&diag_state_for_log, &line);
                });
            }
            let handle = app.handle().clone();
            let start_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                let _ = tauri::async_runtime::spawn_blocking(move || {
                    asr_sidecar::try_start_bundled(&start_handle);
                })
                .await;
                asr_sidecar::warm::spawn_watchdog(handle);
            });
            #[cfg(target_os = "macos")]
            app_info::attach_macos_app_menu(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info::app_version,
            app_info::app_build_info,
            app_info::read_third_party_licenses,
            app_info::open_bundled_user_guide,
            asr_setup::diagnose::asr_setup_diagnose,
            asr_sidecar::bundled::launch::bundled_asr_launch_report,
            // Intentional defer: registered for env-page FSM; no TS invoke yet (r3h-i1).
            asr_sidecar::supervisor::asr_supervisor_snapshot,
            local_runtime::local_runtime_diagnose,
            local_runtime::installer::commands::local_runtime_download_sidecar,
            local_runtime::installer::commands::local_runtime_cancel_download,
            local_runtime::recovery::commands::revalidate::local_runtime_revalidate_install,
            local_runtime::recovery::commands::clear::local_runtime_clear_install,
            local_runtime::recovery::commands::restore::local_runtime_restore_previous,
            project::picker_cmd::pick_audio_path,
            project::picker_cmd::pick_audio_paths,
            project::project_create_cmd::project_create_from_audio,
            project::project_create_cmd::create_empty_project,
            project::project_create_cmd::create_project_from_text,
            project::project_create_cmd::create_empty_text_file,
            project::project_create_cmd::import_audio_to_project,
            project::project_create_cmd::import_text_to_project,
            project::file_import_cmd::import_transcript_to_project,
            project::import_duplicate::check_project_import_duplicate,
            project::project_query_cmd::project_list,
            project::project_query_cmd::project_load,
            project::project_query_cmd::project_list_edit_log,
            project::project_query_cmd::project_record_edit_log,
            project::segment_cmd::file_save_segments,
            project::segment_cmd::file_restore_segments_from_edit_log,
            project::run_transcribe_cmd::sync::project_run_transcribe,
            project::transcribe_cancel_cmd::project_cancel_transcribe,
            project::run_transcribe_cmd::async_cmd::project_transcribe_async_start,
            project::run_transcribe_cmd::async_cmd::project_transcribe_async_finalize,
            project::run_transcribe_cmd::sync::get_last_transcribe_timeline,
            project::run_transcribe_cmd::sync::record_transcribe_timeline_poll_progress,
            project::run_transcribe_cmd::sync::record_transcribe_timeline_poll_failure,
            project::project_delete_cmd::project_delete,
            project::project_metadata_cmd::rename_project,
            project::project_metadata_cmd::update_project_metadata,
            project::picker_cmd::pick_text_path,
            project::picker_cmd::ui_desktop_log,
            project::file_cmd::list_files,
            project::file_cmd::load_file,
            project::welcome_search_cmd::welcome_search_files,
            project::welcome_search_cmd::welcome_search_content,
            project::file_cmd::rename_file,
            project::file_cmd::delete_file,
            project::file_cmd::move_file_to_project,
            project::file_cmd::copy_file_to_project,
            project::file_cmd::reveal_project_in_file_manager,
            project::file_cmd::reveal_file_in_file_manager,
            project::waveform_peaks_cmd::ensure_waveform_peaks,
            project::waveform_peaks_cmd::waveform_peaks_status,
            project::waveform_asset_cmd::scoped_waveform_file_meta,
            native_audio::commands::native_audio_load,
            native_audio::commands::native_audio_play,
            native_audio::commands::native_audio_pause,
            native_audio::commands::native_audio_seek,
            native_audio::commands::native_audio_set_rate,
            native_audio::commands::native_audio_snapshot,
            native_audio::commands::native_audio_stop,
            project::export_cmd::export_project_bundle,
            project::export_cmd::import_project_bundle,
            project::asr_runtime_paths_cmd::get_asr_runtime_paths,
            project::asr_cache_cmd::asr_model_cache_info,
            project::asr_cache_cmd::clear_asr_model_cache,
            project::bundled_asr_models_seed::seed_bundled_asr_models_if_needed,
            project::waveform_peaks_cache_cmd::waveform_peaks_cache_info,
            project::waveform_peaks_cache_cmd::clear_orphan_waveform_peaks_cache,
            project::waveform_peaks_cache_cmd::clear_waveform_peaks_for_file,
            project::install_cmd::install_funasr_deps_interactive,
            project::install_cmd::retry_bundled_asr_sidecar,
            asr_sidecar::loopback::asr_loopback_request,
            asr_sidecar::asr_app_manages_bundled_sidecar,
            asr_sidecar::kill_loopback_asr_listeners_cmd,
            local_asr_model::get_local_asr_hub_model_pref,
            local_asr_model::set_local_asr_hub_model_pref,
            local_asr_language::get_local_asr_recognition_language_pref,
            local_asr_language::set_local_asr_recognition_language_pref,
            project::export_cmd::open_app_data_folder,
            project::export_cmd::export_text_file,
            project::glossary_cmd::glossary_list,
            project::glossary_cmd::glossary_add,
            project::glossary_cmd::glossary_add_batch,
            project::glossary_cmd::glossary_update,
            project::glossary_cmd::glossary_delete_batch,
            project::glossary_cmd::glossary_set_hotword_batch,
            project::glossary_cmd::glossary_delete,
            project::glossary_cmd::glossary_hotwords_preview,
            project::glossary_cmd::glossary_import_from_file,
            postprocess_cmd::postprocess_api_key_cmd::llm_save_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_delete_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_has_stored_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_migrate_legacy_api_key,
            postprocess_cmd::postprocess_api_key_cmd::llm_probe_connection,
            postprocess_cmd::postprocess_api_key_cmd::ollama_detect_status,
            stt_online_probe::stt_probe_online_health,
            stt_online_probe::stt_probe_xunfei_credentials,
            stt_online_api_key_cmd::stt_save_api_key,
            stt_online_api_key_cmd::stt_delete_api_key,
            stt_online_api_key_cmd::stt_has_stored_api_key,
            stt_online_api_key_cmd::stt_read_api_key,
            postprocess_cmd::postprocess_auto_punctuate_cmd::postprocess_auto_punctuate,
            postprocess_cmd::postprocess_refine_cmd::postprocess_refine_segments,
            postprocess_cmd::postprocess_stage_b_proofread_cmd::postprocess_stage_b_proofread,
            postprocess_cmd::postprocess_prompt_defaults_cmd::get_llm_prompt_defaults,
            postprocess_cmd::postprocess_cancel_cmd::postprocess_cancel_auto_punctuate,
            postprocess_cmd::postprocess_cancel_cmd::postprocess_cancel_export_polish,
            postprocess_cmd::postprocess_export_polish_cmd::postprocess_export_polish,
            project::segment_cmd::correction_accept_rule,
            project::segment_cmd::correction_stable_rules_list,
            project::segment_cmd::correction_glossary_learn_prompts,
            project::correction_memory_cmd::correction_memory_list,
            project::correction_memory_cmd::correction_memory_save,
            project::correction_memory_cmd::correction_memory_delete,
            project::correction_memory_cmd::correction_glossary_mine_candidates,
            project::lexicon_bundle_cmd::lexicon_bundle_export,
            project::lexicon_bundle_cmd::lexicon_bundle_export_preview,
            project::lexicon_bundle_cmd::lexicon_bundle_import_preview,
            project::lexicon_bundle_cmd::lexicon_bundle_import_apply,
            profile::export_settings_profile,
            profile::import_settings_profile,
            export_docx::export_docx,
            diagnostic::export_diagnostic_bundle,
            project::quality_eval::quality_get_last_report,
            project::quality_eval::quality_get_baseline_report,
            project::quality_eval::quality_run_eval,
            project::quality_eval::quality_import_report_file,
            project::quality_eval::quality_set_baseline_from_last,
            project::quality_eval::quality_last_report_path_cmd,
            project::quality_eval::quality_export_correction_memory_jsonl,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            native_audio::shutdown(app_handle);
            asr_sidecar::stop_bundled(app_handle);
        }
    });
}

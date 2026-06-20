use super::*;
use crate::asr_sidecar::{AsrHealthBody, AsrPortStatus, BundledAsrLaunchReport};
use serde_json::json;

#[test]
fn health_snapshot_reads_caps() {
    let v = json!({
        "service": "rushi-asr",
        "status": "ok",
        "ffmpeg_ok": true,
        "funasr_import_ok": true,
        "funasr_ready": true,
        "funasr_default_model_cached": false,
        "funasr_vad_model_cached": false,
        "funasr_required_models_cached": false,
        "ready_for_transcribe": false,
        "transcription_mode": "funasr"
    });
    let h = health_snapshot_from_value(&v);
    assert!(h.health_reachable);
    assert!(h.funasr_ready);
    assert!(!h.funasr_default_model_cached);
    assert!(!h.selected_model_ready);
}

#[test]
fn health_fetch_from_probe_maps_ok() {
    let v = json!({ "service": "rushi-asr", "status": "ok" });
    assert!(matches!(
        health_fetch_from_probe(&AsrHealthBody::Ok(v)),
        HealthFetch::Ok(_)
    ));
}

#[test]
fn health_fetch_from_probe_maps_http_error() {
    assert_eq!(
        health_fetch_from_probe(&AsrHealthBody::HttpError(503)),
        HealthFetch::HttpError(503)
    );
}

#[test]
fn health_fetch_from_probe_maps_unreachable() {
    assert_eq!(
        health_fetch_from_probe(&AsrHealthBody::Unreachable),
        HealthFetch::Unreachable
    );
}

#[test]
fn foreign_port_sets_blocking_without_recovery_path() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    let (_lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::Foreign,
        port_detail: &Some("占用".into()),
        bundled_available: false,
        local_runtime_status: &InstalledRuntimeStatus::Missing,
        sidecar_integrity: "unknown",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(block.is_some());
}

#[test]
fn foreign_port_with_bundled_does_not_block() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    let (_lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::Foreign,
        port_detail: &Some("8741 已有服务监听，但未能按 rushi-asr /health 响应".into()),
        bundled_available: true,
        local_runtime_status: &InstalledRuntimeStatus::Missing,
        sidecar_integrity: "unknown",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(block.is_none());
}

#[test]
fn foreign_port_with_installed_runtime_does_not_block() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    let (_lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::Foreign,
        port_detail: &Some("占用".into()),
        bundled_available: false,
        local_runtime_status: &InstalledRuntimeStatus::Installed,
        sidecar_integrity: "unknown",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(block.is_none());
}

#[test]
fn sidecar_integrity_corrupt_on_health_500() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    assert_eq!(
        infer_sidecar_integrity(
            true,
            &InstalledRuntimeStatus::Missing,
            &AsrPortStatus::RushiAsr,
            &HealthFetch::HttpError(500),
            &health,
        ),
        "corrupt"
    );
}

#[test]
fn sidecar_integrity_keeps_foreign_http_500_as_unknown() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    assert_eq!(
        infer_sidecar_integrity(
            true,
            &InstalledRuntimeStatus::Missing,
            &AsrPortStatus::Foreign,
            &HealthFetch::HttpError(500),
            &health,
        ),
        "unknown"
    );
}

#[test]
fn sidecar_integrity_ok_when_import_ok() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: true,
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_ready: true,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "funasr".into(),
    };
    let v = json!({ "service": "rushi-asr", "funasr_import_ok": true });
    assert_eq!(
        infer_sidecar_integrity(
            true,
            &InstalledRuntimeStatus::Missing,
            &AsrPortStatus::RushiAsr,
            &HealthFetch::Ok(v),
            &health,
        ),
        "ok"
    );
}

#[test]
fn sidecar_integrity_not_installed_without_bundle() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    assert_eq!(
        infer_sidecar_integrity(
            false,
            &InstalledRuntimeStatus::Missing,
            &AsrPortStatus::Free,
            &HealthFetch::Unreachable,
            &health,
        ),
        "not_installed"
    );
}

#[test]
fn corrupt_bundle_adds_blocking_summary() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    let (lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::RushiAsr,
        port_detail: &None,
        bundled_available: true,
        local_runtime_status: &InstalledRuntimeStatus::Missing,
        sidecar_integrity: "corrupt",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(lines.iter().any(|l| l.contains("损坏")));
    assert!(block.is_some());
}

#[test]
fn partial_aux_model_blocks_ready_summary() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: true,
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_ready: true,
        funasr_default_model_cached: true,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    let (lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::RushiAsr,
        port_detail: &None,
        bundled_available: true,
        local_runtime_status: &InstalledRuntimeStatus::Missing,
        sidecar_integrity: "ok",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(lines.iter().any(|l| l.contains("VAD")));
    assert!(block.is_some());
}

#[test]
fn installed_local_runtime_changes_missing_bundle_summary() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    let (lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::Free,
        port_detail: &None,
        bundled_available: false,
        local_runtime_status: &InstalledRuntimeStatus::Installed,
        sidecar_integrity: "not_installed",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(lines
        .iter()
        .any(|l| l.contains("应用数据目录已检测到已安装的侧车运行时")));
    assert!(block.is_none());
}

#[test]
fn sidecar_integrity_corrupt_when_local_runtime_corrupt() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    assert_eq!(
        infer_sidecar_integrity(
            false,
            &InstalledRuntimeStatus::Corrupt,
            &AsrPortStatus::Free,
            &HealthFetch::Unreachable,
            &health,
        ),
        "corrupt"
    );
}

#[test]
fn corrupt_local_runtime_adds_blocking_summary() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: false,
        ffmpeg_ok: false,
        funasr_import_ok: false,
        funasr_ready: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "stub".into(),
    };
    let (lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::Free,
        port_detail: &None,
        bundled_available: false,
        local_runtime_status: &InstalledRuntimeStatus::Corrupt,
        sidecar_integrity: "corrupt",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(lines.iter().any(|l| l.contains("已损坏或不完整")));
    assert!(block.is_some());
}

#[test]
fn ffmpeg_missing_adds_repair_blocking_summary() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: true,
        ffmpeg_ok: false,
        funasr_import_ok: true,
        funasr_ready: true,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "funasr".into(),
    };
    let (lines, block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::RushiAsr,
        port_detail: &None,
        bundled_available: true,
        local_runtime_status: &InstalledRuntimeStatus::Missing,
        sidecar_integrity: "ok",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: None,
        prepare_job_id: None,
        lrc_install_phase: None,
    });
    assert!(lines.iter().any(|l| l.contains("FFmpeg")));
    let block = block.expect("ffmpeg missing should block");
    assert!(block.contains("FFmpeg"));
    #[cfg(debug_assertions)]
    assert!(block.contains("PATH"));
    #[cfg(not(debug_assertions))]
    assert!(block.contains("一键准备"));
}

#[test]
fn artifact_job_summary_lines_describe_active_downloads() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: true,
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_ready: true,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "funasr".into(),
    };
    let (lines, _block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::RushiAsr,
        port_detail: &None,
        bundled_available: true,
        local_runtime_status: &InstalledRuntimeStatus::Installed,
        sidecar_integrity: "ok",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: Some("running"),
        prepare_job_id: Some("job-123"),
        lrc_install_phase: Some("downloading"),
    });
    assert!(lines.iter().any(|l| l.contains("运行时安装进行中")));
    assert!(lines.iter().any(|l| l.contains("转写模型下载进行中")));
    assert!(lines.iter().any(|l| l.contains("job-123")));
}

#[test]
fn artifact_job_summary_lines_describe_stale_prepare() {
    let health = AsrSetupHealthSnapshot {
        health_reachable: true,
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_ready: true,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        ready_for_transcribe: false,
        selected_model_ready: false,
        transcription_mode: "funasr".into(),
    };
    let (lines, _block) = build_summary(SummaryContext {
        port_status: &AsrPortStatus::RushiAsr,
        port_detail: &None,
        bundled_available: true,
        local_runtime_status: &InstalledRuntimeStatus::Installed,
        sidecar_integrity: "ok",
        bundled_launch: &BundledAsrLaunchReport::default(),
        health: &health,
        disk_low: false,
        prepare_phase: Some("stale"),
        prepare_job_id: Some("job-stuck"),
        lrc_install_phase: None,
    });
    assert!(lines.iter().any(|l| l.contains("可能已卡住")));
    assert!(lines.iter().any(|l| l.contains("job-stuck")));
}

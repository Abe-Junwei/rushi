use crate::asr_sidecar::{
    probe_asr_port, AsrPortStatus, BundledAsrLaunchReport, BundledAsrLaunchState,
};
use crate::local_runtime::disk_free_bytes;
use crate::local_runtime::integrity::{inspect_installed_runtime, InstalledRuntimeStatus};
use crate::DbState;
use serde::Serialize;
use serde_json::Value;
use std::ops::Deref;
use tauri::{AppHandle, Manager, State};

const DISK_LOW_BYTES: u64 = 500 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrSetupHealthSnapshot {
    pub health_reachable: bool,
    pub ffmpeg_ok: bool,
    pub funasr_import_ok: bool,
    pub funasr_ready: bool,
    pub funasr_default_model_cached: bool,
    pub funasr_vad_model_cached: bool,
    pub funasr_required_models_cached: bool,
    pub ready_for_transcribe: bool,
    pub transcription_mode: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrSetupReport {
    pub port_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port_detail: Option<String>,
    pub bundled_available: bool,
    /// `ok` | `corrupt` | `unknown` | `not_installed`
    pub sidecar_integrity: String,
    pub bundled_launch: BundledAsrLaunchReport,
    pub health: AsrSetupHealthSnapshot,
    pub models_root: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_free_bytes: Option<u64>,
    pub disk_low: bool,
    pub ready_for_transcribe: bool,
    pub summary_lines: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocking_issue: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum HealthFetch {
    Ok(Value),
    HttpError(u16),
    Unreachable,
}

fn health_snapshot_from_value(v: &Value) -> AsrSetupHealthSnapshot {
    let mode = v
        .get("transcription_mode")
        .and_then(|m| m.as_str())
        .unwrap_or("stub");
    let ffmpeg_ok = v.get("ffmpeg_ok").and_then(|x| x.as_bool()) == Some(true);
    let funasr_import_ok = v.get("funasr_import_ok").and_then(|x| x.as_bool()) == Some(true);
    let funasr_ready = v.get("funasr_ready").and_then(|x| x.as_bool()) == Some(true);
    let funasr_default_model_cached = v
        .get("funasr_default_model_cached")
        .and_then(|x| x.as_bool())
        == Some(true);
    let funasr_vad_model_cached =
        v.get("funasr_vad_model_cached").and_then(|x| x.as_bool()) == Some(true);
    let funasr_required_models_cached = v
        .get("funasr_required_models_cached")
        .and_then(|x| x.as_bool())
        == Some(true);
    let ready_for_transcribe =
        v.get("ready_for_transcribe").and_then(|x| x.as_bool()) == Some(true);
    AsrSetupHealthSnapshot {
        health_reachable: true,
        ffmpeg_ok,
        funasr_import_ok,
        funasr_ready,
        funasr_default_model_cached,
        funasr_vad_model_cached,
        funasr_required_models_cached,
        ready_for_transcribe,
        transcription_mode: mode.to_string(),
    }
}

async fn fetch_rushi_health() -> HealthFetch {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
    {
        Ok(c) => c,
        Err(_) => return HealthFetch::Unreachable,
    };
    let resp = match client.get(crate::asr_sidecar::ASR_HEALTH_URL).send().await {
        Ok(r) => r,
        Err(_) => return HealthFetch::Unreachable,
    };
    let status = resp.status().as_u16();
    if !resp.status().is_success() {
        return HealthFetch::HttpError(status);
    }
    let text = match resp.text().await {
        Ok(t) => t,
        Err(_) => return HealthFetch::Unreachable,
    };
    let v: Value = match serde_json::from_str(&text) {
        Ok(j) => j,
        Err(_) => return HealthFetch::Unreachable,
    };
    if crate::asr_sidecar::is_rushi_asr_health_json(&v) {
        HealthFetch::Ok(v)
    } else {
        HealthFetch::Unreachable
    }
}

fn infer_sidecar_integrity(
    bundled_available: bool,
    local_runtime_status: &InstalledRuntimeStatus,
    port: &AsrPortStatus,
    fetch: &HealthFetch,
    health: &AsrSetupHealthSnapshot,
) -> &'static str {
    if matches!(local_runtime_status, InstalledRuntimeStatus::Corrupt) {
        return "corrupt";
    }

    if !bundled_available && matches!(local_runtime_status, InstalledRuntimeStatus::Missing) {
        return "not_installed";
    }

    match fetch {
        HealthFetch::HttpError(code)
            if (400..500).contains(code) && matches!(port, AsrPortStatus::RushiAsr) =>
        {
            return "corrupt";
        }
        HealthFetch::HttpError(code) if *code >= 500 && matches!(port, AsrPortStatus::RushiAsr) => {
            return "corrupt";
        }
        HealthFetch::Ok(_) if health.health_reachable && !health.funasr_import_ok => {
            if matches!(port, AsrPortStatus::RushiAsr | AsrPortStatus::Free) {
                return "corrupt";
            }
        }
        HealthFetch::Ok(_)
            if matches!(port, AsrPortStatus::Foreign)
                && !health.funasr_import_ok
                && !health.ffmpeg_ok =>
        {
            return "unknown";
        }
        HealthFetch::Ok(_) if health.health_reachable && health.funasr_import_ok => return "ok",
        _ => {}
    }

    if health.health_reachable && health.funasr_import_ok {
        "ok"
    } else {
        "unknown"
    }
}

struct SummaryContext<'a> {
    port_status: &'a AsrPortStatus,
    port_detail: &'a Option<String>,
    bundled_available: bool,
    local_runtime_status: &'a InstalledRuntimeStatus,
    sidecar_integrity: &'a str,
    bundled_launch: &'a BundledAsrLaunchReport,
    health: &'a AsrSetupHealthSnapshot,
    disk_low: bool,
}

fn build_summary(summary: SummaryContext<'_>) -> (Vec<String>, Option<String>) {
    let mut lines = Vec::new();
    let mut blocking = None;

    match summary.port_status {
        AsrPortStatus::Free => {
            lines.push("8741 端口空闲，可启动内置推理侧车。".into());
        }
        AsrPortStatus::RushiAsr => {
            lines.push("本机 rushi-asr 已在 8741 响应 /health。".into());
        }
        AsrPortStatus::Foreign => {
            let msg = summary
                .port_detail
                .clone()
                .unwrap_or_else(|| "8741 已被其他程序占用。".into());
            lines.push(msg.clone());
            blocking = Some(msg);
        }
    }

    if summary.bundled_available {
        lines.push("安装包内已检测到内置侧车可执行文件。".into());
        if summary.sidecar_integrity == "corrupt" {
            let msg: String = "内置侧车包可能损坏（FunASR 资源缺失或 /health 异常）。需重新构建或应用内下载侧车（R3h-1）。".into();
            lines.push(msg.clone());
            if blocking.is_none() {
                blocking = Some(msg);
            }
        } else if summary.sidecar_integrity == "unknown" {
            lines.push("侧车完整性尚未确认，可尝试一键准备启动后再诊断。".into());
        }
    } else if matches!(
        summary.local_runtime_status,
        InstalledRuntimeStatus::Installed
    ) {
        lines.push("应用数据目录已检测到已安装的侧车运行时。".into());
    } else if matches!(
        summary.local_runtime_status,
        InstalledRuntimeStatus::Corrupt
    ) {
        let msg: String =
            "应用数据目录中的侧车运行时已损坏或不完整，请重新下载 / 修复语音识别组件。".into();
        lines.push(msg.clone());
        if blocking.is_none() {
            blocking = Some(msg);
        }
    } else {
        lines.push(
            "未检测到可用侧车（开发环境需先 build sidecar，或通过应用内下载 / 修复组件）。".into(),
        );
        if blocking.is_none() && !summary.health.health_reachable {
            blocking = Some(
                "无可用侧车且 ASR 未连通。请先构建侧车，或通过应用内下载 / 修复语音识别组件。"
                    .into(),
            );
        }
    }

    if summary.bundled_launch.attempted {
        if summary.bundled_launch.success {
            lines.push("最近一次内置侧车启动成功。".into());
        } else if let Some(d) = &summary.bundled_launch.detail {
            lines.push(format!("内置侧车启动未成功：{d}"));
        }
    }

    if summary.health.health_reachable {
        if summary.health.ready_for_transcribe {
            lines.push("FunASR 与必需模型均已就绪，可直接转写。".into());
        } else if summary.health.funasr_ready {
            lines.push("FunASR 运行时已就绪。".into());
        } else if summary.health.ffmpeg_ok {
            lines.push("ASR 已连通，但 FunASR 未就绪（可能仍为 stub）。".into());
            if blocking.is_none() && summary.sidecar_integrity != "corrupt" {
                blocking = Some("FunASR 未就绪。请使用「一键准备」重试侧车。".into());
            }
        } else {
            lines.push("ASR 已连通，但未检测到 FFmpeg。".into());
            if blocking.is_none() {
                blocking = Some("侧车内 FFmpeg 不可用，无法解码音频。".into());
            }
        }
        if summary.health.funasr_required_models_cached {
            lines.push("默认转写模型及必需辅助模型已缓存。".into());
        } else if summary.health.funasr_default_model_cached
            && !summary.health.funasr_vad_model_cached
        {
            lines.push("默认转写模型已缓存，但辅助 VAD 模型尚未完成。".into());
            if blocking.is_none() {
                blocking =
                    Some("默认模型缓存未完整完成，请继续执行一键准备或重新下载模型。".into());
            }
        } else if summary.health.funasr_ready {
            lines.push("默认模型尚未下载，一键准备将拉取 Paraformer 长音频权重。".into());
        }
    } else if blocking.is_none() && summary.sidecar_integrity != "corrupt" {
        lines.push("尚未连通 rushi-asr /health。".into());
        blocking = Some(
            if matches!(
                summary.local_runtime_status,
                InstalledRuntimeStatus::Installed
            ) {
                "无法读取 ASR 能力。请先一键准备或重试应用数据侧车。".into()
            } else {
                "无法读取 ASR 能力。请先一键准备或重试内置侧车。".into()
            },
        );
    }

    if summary.disk_low {
        lines.push("模型缓存所在磁盘可用空间不足 500MB，下载可能失败。".into());
        if blocking.is_none()
            && summary.health.funasr_ready
            && !summary.health.funasr_required_models_cached
        {
            blocking = Some("磁盘空间不足，请先清理后再下载模型。".into());
        }
    }

    (lines, blocking)
}

#[tauri::command]
pub async fn asr_setup_diagnose(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<AsrSetupReport, String> {
    let st: &DbState = state.deref();
    let models_root = crate::project::models_root_for_app_data_root(&st.root);
    let models_root_str = models_root.to_string_lossy().to_string();

    let port = probe_asr_port().await;
    let port_status = match port.status {
        AsrPortStatus::Free => "free",
        AsrPortStatus::RushiAsr => "rushi_asr",
        AsrPortStatus::Foreign => "foreign",
    }
    .to_string();

    let bundled_available = crate::asr_sidecar::bundled_sidecar_resources_present(&app);
    let bundled_launch = app
        .try_state::<BundledAsrLaunchState>()
        .map(|s| s.0.lock().map(|g| g.clone()).unwrap_or_default())
        .unwrap_or_default();
    let local_runtime_info = inspect_installed_runtime(&st.root);

    let health_fetch = fetch_rushi_health().await;
    let health = match &health_fetch {
        HealthFetch::Ok(v) => health_snapshot_from_value(v),
        _ => AsrSetupHealthSnapshot {
            health_reachable: false,
            ffmpeg_ok: false,
            funasr_import_ok: false,
            funasr_ready: false,
            funasr_default_model_cached: false,
            funasr_vad_model_cached: false,
            funasr_required_models_cached: false,
            ready_for_transcribe: false,
            transcription_mode: "stub".into(),
        },
    };

    let sidecar_integrity = infer_sidecar_integrity(
        bundled_available,
        &local_runtime_info.status,
        &port.status,
        &health_fetch,
        &health,
    )
    .to_string();

    let disk_free_bytes = disk_free_bytes(&models_root);
    let disk_low = disk_free_bytes.map(|b| b < DISK_LOW_BYTES).unwrap_or(false);

    let ready_for_transcribe = health.health_reachable && health.ready_for_transcribe;

    let (summary_lines, blocking_issue) = build_summary(SummaryContext {
        port_status: &port.status,
        port_detail: &port.detail,
        bundled_available,
        local_runtime_status: &local_runtime_info.status,
        sidecar_integrity: &sidecar_integrity,
        bundled_launch: &bundled_launch,
        health: &health,
        disk_low,
    });

    Ok(AsrSetupReport {
        port_status,
        port_detail: port.detail,
        bundled_available,
        sidecar_integrity,
        bundled_launch,
        health,
        models_root: models_root_str,
        disk_free_bytes,
        disk_low,
        ready_for_transcribe,
        summary_lines,
        blocking_issue,
    })
}

#[cfg(test)]
#[path = "diagnose_tests.rs"]
mod tests;

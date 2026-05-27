//! Optional bundled ASR sidecar (PyInstaller onedir under `resources/bundled-asr/`).
//! If `127.0.0.1:8741/health` is already up, we do not start a second server.
//!
//! Windows (x64): policy ships **two** onedirs — `rushi-asr-sidecar` (CPU) and
//! `rushi-asr-sidecar-cuda` (CUDA torch). When NVIDIA driver tooling is present and
//! the CUDA bundle exists, we try CUDA first; on failure we fall back to CPU.
//! Set `RUSHI_FORCE_BUNDLED_ASR_CPU=1` to skip CUDA selection.
//!
//! Model weights cache: passes `RUSHI_MODELS_ROOT` + hub cache dirs to the child so
//! FunASR / ModelScope download under `{app_data}/studio.lingchuang.rushi/models/`.

use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::DbState;

pub const ASR_HEALTH_URL: &str = "http://127.0.0.1:8741/health";
const ASR_LOOPBACK_PORT: u16 = 8741;
const BUNDLED_HEALTH_WAIT_MS: u64 = 45_000;
const BUNDLED_HEALTH_POLL_MS: u64 = 250;

pub struct AsrSidecarState(pub Mutex<Option<Child>>);

/// Last bundled sidecar launch outcome (for P1 UI when loopback ASR is unreachable).
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledAsrLaunchReport {
    pub attempted: bool,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

pub struct BundledAsrLaunchState(pub Mutex<BundledAsrLaunchReport>);

fn append_sidecar_log_line(handle: &AppHandle, line: &str) {
    if let Some(st) = handle.try_state::<DbState>() {
        crate::project::utils::append_desktop_log_line(&st, line);
    }
}

fn write_launch_report(handle: &AppHandle, report: BundledAsrLaunchReport) {
    if let Some(st) = handle.try_state::<BundledAsrLaunchState>() {
        if let Ok(mut g) = st.0.lock() {
            *g = report;
        }
    }
}

#[tauri::command]
pub fn bundled_asr_launch_report(
    state: tauri::State<BundledAsrLaunchState>,
) -> BundledAsrLaunchReport {
    state.0.lock().map(|g| g.clone()).unwrap_or_default()
}

fn validate_bundled_exe(exe: &Path) -> Option<PathBuf> {
    if exe.is_file() {
        if let Ok(meta) = std::fs::metadata(exe) {
            if meta.len() > 1024 {
                return Some(exe.to_path_buf());
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn sidecar_exe_path(resource_root: &Path, onedir: &str, stem: &str) -> Option<PathBuf> {
    let exe = resource_root
        .join("bundled-asr")
        .join(onedir)
        .join(format!("{stem}.exe"));
    validate_bundled_exe(&exe)
}

#[cfg(not(target_os = "windows"))]
fn sidecar_exe_path(resource_root: &Path, onedir: &str, stem: &str) -> Option<PathBuf> {
    let exe = resource_root.join("bundled-asr").join(onedir).join(stem);
    validate_bundled_exe(&exe)
}

fn bundled_cpu_executable(resource_root: &Path) -> Option<PathBuf> {
    sidecar_exe_path(resource_root, "rushi-asr-sidecar", "rushi-asr-sidecar")
}

#[cfg(target_os = "windows")]
fn bundled_cuda_executable(resource_root: &Path) -> Option<PathBuf> {
    sidecar_exe_path(
        resource_root,
        "rushi-asr-sidecar-cuda",
        "rushi-asr-sidecar-cuda",
    )
}

/// Heuristic: NVIDIA user-mode driver + `nvidia-smi` ship path (DCH vs legacy).
#[cfg(target_os = "windows")]
fn windows_cuda_probe_ok() -> bool {
    const NV_CUDA: &str = r"C:\Windows\System32\nvcuda.dll";
    const NV_SMI_SYS32: &str = r"C:\Windows\System32\nvidia-smi.exe";
    const NV_SMI_LEGACY: &str = r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe";
    Path::new(NV_CUDA).is_file()
        && (Path::new(NV_SMI_SYS32).is_file() || Path::new(NV_SMI_LEGACY).is_file())
}

#[cfg(target_os = "windows")]
fn bundled_sidecar_try_order(resource_root: &Path) -> Vec<PathBuf> {
    let force_cpu = std::env::var("RUSHI_FORCE_BUNDLED_ASR_CPU").ok().as_deref() == Some("1");
    let cpu = bundled_cpu_executable(resource_root);
    let cuda = bundled_cuda_executable(resource_root);
    let mut out = Vec::new();
    if force_cpu {
        if let Some(p) = cpu {
            out.push(p);
        }
        return out;
    }
    if let (Some(cuda_p), Some(cpu_p)) = (cuda, cpu) {
        if windows_cuda_probe_ok() {
            out.push(cuda_p);
        }
        out.push(cpu_p);
    } else if let Some(p) = cuda {
        if windows_cuda_probe_ok() {
            out.push(p);
        } else if let Some(p2) = cpu {
            out.push(p2);
        }
    } else if let Some(p) = cpu {
        out.push(p);
    }
    out
}

#[cfg(not(target_os = "windows"))]
fn bundled_sidecar_try_order(resource_root: &Path) -> Vec<PathBuf> {
    bundled_cpu_executable(resource_root).into_iter().collect()
}

fn candidate_resource_roots_from_parts(
    resource_dir: Option<PathBuf>,
    manifest_dir: &Path,
) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(res_dir) = resource_dir {
        roots.push(res_dir.clone());
        if res_dir.file_name().and_then(|s| s.to_str()) != Some("resources") {
            roots.push(res_dir.join("resources"));
        }
    }

    roots.push(manifest_dir.join("target").join("debug").join("resources"));
    roots.push(
        manifest_dir
            .parent()
            .unwrap_or(manifest_dir)
            .join("target")
            .join("debug")
            .join("resources"),
    );
    roots.push(manifest_dir.join("resources"));

    let mut unique = Vec::new();
    for root in roots {
        if !unique.iter().any(|existing: &PathBuf| existing == &root) {
            unique.push(root);
        }
    }
    unique
}

fn candidate_resource_roots(handle: &AppHandle) -> Vec<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // In `tauri dev`, the source resources directory is the most reliable place to
    // inspect the freshly rebuilt PyInstaller onedir.
    candidate_resource_roots_from_parts(handle.path().resource_dir().ok(), &manifest_dir)
}

fn bundled_sidecar_candidates_from_roots(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for root in roots {
        for exe in bundled_sidecar_try_order(root) {
            if !out.iter().any(|existing: &PathBuf| existing == &exe) {
                out.push(exe);
            }
        }
    }
    out
}

fn bundled_sidecar_candidates(handle: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(st) = handle.try_state::<DbState>() {
        if let Some(exe) = crate::local_runtime::integrity::resolve_installed_executable(&st.root) {
            out.push(exe);
        }
    }
    for exe in bundled_sidecar_candidates_from_roots(&candidate_resource_roots(handle)) {
        if !out.iter().any(|existing: &PathBuf| existing == &exe) {
            out.push(exe);
        }
    }
    out
}

fn reap_bundled_sidecar_if_exited(handle: &AppHandle) {
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        return;
    };
    let Ok(mut g) = s.0.lock() else {
        return;
    };
    if let Some(ref mut child) = *g {
        if let Ok(Some(_)) = child.try_wait() {
            *g = None;
        }
    }
}

pub fn is_rushi_asr_health_json(v: &Value) -> bool {
    v.get("service").and_then(|s| s.as_str()) == Some("rushi-asr")
        && v.get("status").and_then(|s| s.as_str()) == Some("ok")
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AsrPortStatus {
    Free,
    RushiAsr,
    Foreign,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrPortProbe {
    pub status: AsrPortStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Classify who is listening on loopback :8741.
pub async fn probe_asr_port() -> AsrPortProbe {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let resp = match client.get(ASR_HEALTH_URL).send().await {
        Ok(resp) => resp,
        Err(_) => {
            return if loopback_port_accepts_tcp(ASR_LOOPBACK_PORT) {
                AsrPortProbe {
                    status: AsrPortStatus::Foreign,
                    http_status: None,
                    detail: Some(
                        "8741 已有服务监听，但未能按 rushi-asr /health 响应；可能是其他进程占用，或是仍在启动中的旧实例。请稍候重试；若持续存在，请结束占用进程。".into(),
                    ),
                }
            } else {
                AsrPortProbe {
                    status: AsrPortStatus::Free,
                    http_status: None,
                    detail: Some("8741 端口无监听，可启动内置侧车。".into()),
                }
            };
        }
    };
    let http_status = resp.status().as_u16();
    let text = resp.text().await.unwrap_or_default();
    let Ok(v) = serde_json::from_str::<Value>(&text) else {
        return AsrPortProbe {
            status: AsrPortStatus::Foreign,
            http_status: Some(http_status),
            detail: Some(format!(
                "8741 有服务响应，但不是 rushi-asr /health JSON（HTTP {http_status}）。请先结束占用该端口的其他进程。"
            )),
        };
    };
    if is_rushi_asr_health_json(&v) {
        return AsrPortProbe {
            status: AsrPortStatus::RushiAsr,
            http_status: Some(http_status),
            detail: None,
        };
    }
    let service = v.get("service").and_then(|s| s.as_str()).unwrap_or("未知");
    AsrPortProbe {
        status: AsrPortStatus::Foreign,
        http_status: Some(http_status),
        detail: Some(format!(
            "8741 已被其他服务占用（service={service}，HTTP {http_status}）。内置侧车无法同端口启动。"
        )),
    }
}

fn loopback_port_accepts_tcp(port: u16) -> bool {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    TcpStream::connect_timeout(&addr.into(), Duration::from_millis(250)).is_ok()
}

/// True when install media includes at least one bundled sidecar executable.
pub fn bundled_sidecar_resources_present(handle: &AppHandle) -> bool {
    !bundled_sidecar_candidates_from_roots(&candidate_resource_roots(handle)).is_empty()
}

/// True when `GET /health` returns JSON that looks like **this** rushi-asr (not merely "something on :8741").
pub fn bundled_health_looks_like_rushi_asr() -> bool {
    tauri::async_runtime::block_on(async {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let Ok(resp) = client.get(ASR_HEALTH_URL).send().await else {
            return false;
        };
        if !resp.status().is_success() {
            return false;
        }
        let Ok(text) = resp.text().await else {
            return false;
        };
        let Ok(v): Result<Value, _> = serde_json::from_str(&text) else {
            return false;
        };
        is_rushi_asr_health_json(&v)
    })
}

fn spawn_sidecar(exe: &Path, handle: &AppHandle) -> std::io::Result<Child> {
    let workdir = exe
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut cmd = Command::new(exe);
    cmd.current_dir(&workdir)
        .env("ASR_HOST", "127.0.0.1")
        .env("ASR_PORT", "8741")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(st) = handle.try_state::<DbState>() {
        let models = st.root.join("models");
        if std::fs::create_dir_all(&models).is_ok() {
            cmd.env("RUSHI_MODELS_ROOT", &models);
            let ms = models.join("modelscope");
            let _ = std::fs::create_dir_all(&ms);
            cmd.env("MODELSCOPE_CACHE", &ms);
            let hf = models.join("huggingface");
            let _ = std::fs::create_dir_all(&hf);
            cmd.env("HF_HOME", &hf);
        }
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    append_sidecar_log_line(
        handle,
        &format!("INFO bundled_sidecar_spawn {}", exe.display()),
    );
    cmd.spawn()
}

fn wait_health_store_child(handle: &AppHandle, mut child: Child) -> bool {
    reap_bundled_sidecar_if_exited(handle);
    let attempts = (BUNDLED_HEALTH_WAIT_MS / BUNDLED_HEALTH_POLL_MS) as usize;
    for _ in 0..attempts {
        std::thread::sleep(Duration::from_millis(BUNDLED_HEALTH_POLL_MS));
        reap_bundled_sidecar_if_exited(handle);
        if let Ok(Some(status)) = child.try_wait() {
            append_sidecar_log_line(
                handle,
                &format!("ERROR bundled_sidecar_exited_before_health status={status}"),
            );
            return false;
        }
        if !bundled_health_looks_like_rushi_asr() {
            continue;
        }
        if let Ok(Some(status)) = child.try_wait() {
            append_sidecar_log_line(
                handle,
                &format!("ERROR bundled_sidecar_exited_after_health status={status}"),
            );
            return false;
        }
        match handle.try_state::<AsrSidecarState>() {
            Some(s) => {
                let Ok(mut g) = s.0.lock() else {
                    eprintln!("[rushi-asr-sidecar] mutex poisoned; cannot store child");
                    append_sidecar_log_line(handle, "ERROR bundled_sidecar_mutex_poisoned");
                    let _ = child.kill();
                    return false;
                };
                *g = Some(child);
            }
            None => {
                eprintln!("[rushi-asr-sidecar] internal: AsrSidecarState missing");
                append_sidecar_log_line(handle, "ERROR bundled_sidecar_state_missing");
                let _ = child.kill();
                return false;
            }
        }
        eprintln!(
            "[rushi-asr-sidecar] started bundled ASR at {}",
            ASR_HEALTH_URL
        );
        append_sidecar_log_line(handle, "INFO bundled_sidecar_health_ok");
        return true;
    }
    let _ = child.kill();
    let _ = child.wait();
    append_sidecar_log_line(handle, "ERROR bundled_sidecar_health_timeout");
    false
}

/// Start bundled ASR if present and nothing is already listening on :8741.
pub fn try_start_bundled(handle: &AppHandle) {
    write_launch_report(handle, BundledAsrLaunchReport::default());
    if std::env::var("RUSHI_SKIP_BUNDLED_ASR").ok().as_deref() == Some("1") {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_skip_env");
        return;
    }
    reap_bundled_sidecar_if_exited(handle);
    let candidates = bundled_sidecar_candidates(handle);
    if candidates.is_empty() {
        append_sidecar_log_line(handle, "INFO bundled_sidecar_missing");
        return;
    }
    if bundled_health_looks_like_rushi_asr() {
        eprintln!(
            "[rushi-asr-sidecar] {} already healthy; skip bundled start.",
            ASR_HEALTH_URL
        );
        append_sidecar_log_line(handle, "INFO bundled_sidecar_already_healthy");
        return;
    }
    write_launch_report(
        handle,
        BundledAsrLaunchReport {
            attempted: true,
            success: false,
            detail: None,
        },
    );
    for exe in candidates {
        eprintln!(
            "[rushi-asr-sidecar] trying bundled executable: {}",
            exe.display()
        );
        let child = match spawn_sidecar(&exe, handle) {
            Ok(c) => c,
            Err(e) => {
                eprintln!(
                    "[rushi-asr-sidecar] spawn failed for {}: {e}",
                    exe.display()
                );
                append_sidecar_log_line(
                    handle,
                    &format!("ERROR bundled_sidecar_spawn_failed {} {e}", exe.display()),
                );
                continue;
            }
        };
        if wait_health_store_child(handle, child) {
            write_launch_report(
                handle,
                BundledAsrLaunchReport {
                    attempted: true,
                    success: true,
                    detail: None,
                },
            );
            return;
        }
        eprintln!(
            "[rushi-asr-sidecar] {} did not become healthy in time; trying next candidate if any.",
            exe.display()
        );
        append_sidecar_log_line(
            handle,
            &format!(
                "ERROR bundled_sidecar_candidate_unhealthy {}",
                exe.display()
            ),
        );
    }
    let detail = Some(
        "已尝试启动安装包内的推理侧车，但在等待时间内未收到 /health 成功响应（若同时存在 CUDA 与 CPU 包，可能均已失败）。\
         请确认本机 8741 端口未被其他 rushi-asr 占用；可设置 RUSHI_SKIP_BUNDLED_ASR=1 后手动启动 ASR，\
         或使用「导出诊断包」查看更多信息。"
            .to_string(),
    );
    write_launch_report(
        handle,
        BundledAsrLaunchReport {
            attempted: true,
            success: false,
            detail,
        },
    );
    eprintln!(
        "[rushi-asr-sidecar] bundled ASR did not become healthy. \
         Set RUSHI_SKIP_BUNDLED_ASR=1 to skip, RUSHI_FORCE_BUNDLED_ASR_CPU=1 to avoid CUDA bundle, \
         or rebuild PyInstaller output (see scripts/build-asr-sidecar-*)."
    );
    append_sidecar_log_line(handle, "ERROR bundled_sidecar_all_candidates_failed");
}

/// Stop bundled sidecar (if we started it) and try starting again (e.g. after a transient failure).
pub fn retry_bundled(handle: &AppHandle) {
    stop_bundled(handle);
    try_start_bundled(handle);
}

pub fn stop_bundled(handle: &AppHandle) {
    let Some(s) = handle.try_state::<AsrSidecarState>() else {
        return;
    };
    let Ok(mut g) = s.0.lock() else {
        return;
    };
    if let Some(mut c) = g.take() {
        let _ = c.kill();
        let _ = c.wait();
    }
}

#[cfg(test)]
mod tests;

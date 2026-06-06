//! Dev-mode rushi-asr restart from `services/asr/.venv` (`RUSHI_SKIP_BUNDLED_ASR=1`).

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use super::bundled::port::kill_loopback_listeners_on_port;
use super::probe::{bundled_health_looks_like_rushi_asr, health_declares_local_token_required};
use super::ASR_HEALTH_URL;
use super::ASR_LOOPBACK_PORT;
use crate::local_asr_language::read_language_pref;
use crate::local_asr_model::read_hub_model_pref;
use crate::project::app_data_paths::apply_asr_model_env;
use crate::project::models_root_for_app_data_root;
use crate::packaged_hints::dev_or_packaged_str;
use crate::DbState;

const HEALTH_WAIT_MS: u64 = 45_000;
const HEALTH_POLL_MS: u64 = 250;

/// Locate repo root containing `services/asr/pyproject.toml`.
pub fn resolve_rushi_repo_root() -> Option<PathBuf> {
    if let Ok(raw) = std::env::var("RUSHI_REPO_ROOT") {
        let p = PathBuf::from(raw.trim());
        if p.join("services/asr/pyproject.toml").is_file() {
            return p.canonicalize().ok().or(Some(p));
        }
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut cur = manifest.as_path();
    for _ in 0..8 {
        if cur.join("services/asr/pyproject.toml").is_file() {
            return cur
                .canonicalize()
                .ok()
                .map(|p| p.to_path_buf())
                .or_else(|| Some(cur.to_path_buf()));
        }
        cur = cur.parent()?;
    }
    None
}

fn source_asr_python(repo_root: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let win = repo_root.join("services/asr/.venv/Scripts/python.exe");
        if win.is_file() {
            return Some(win);
        }
    }
    #[cfg(not(windows))]
    {
        let unix = repo_root.join("services/asr/.venv/bin/python");
        if unix.is_file() {
            return Some(unix);
        }
    }
    std::env::var("RUSHI_ASR_VENV")
        .ok()
        .map(|s| PathBuf::from(s.trim()))
        .filter(|p| p.is_file())
}

fn dev_asr_log_path() -> PathBuf {
    std::env::var("TMPDIR")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("rushi-asr-dev.log")
}

fn fetch_health_model_id() -> Option<String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .ok()?;
    let resp = client.get(ASR_HEALTH_URL).send().ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let v: serde_json::Value = resp.json().ok()?;
    v.get("funasr_model_id")
        .and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Kill :8741 and spawn `python -m rushi_asr` from source venv with current prefs.
pub fn restart_source_asr_sidecar(app: &AppHandle, st: &DbState) -> Result<(), String> {
    let repo = resolve_rushi_repo_root().ok_or_else(|| {
        dev_or_packaged_str(
            "未找到 Rushi 仓库根目录（需含 services/asr/pyproject.toml）。请用 npm run desktop:dev 启动，或设置 RUSHI_REPO_ROOT。",
            "未找到开发仓库根目录。安装包内请使用「环境与 ASR」管理内置侧车。",
        )
        .to_string()
    })?;
    let python = source_asr_python(&repo).ok_or_else(|| {
        format!(
            "未找到 ASR venv（{}）。{}",
            repo.join("services/asr/.venv").display(),
            dev_or_packaged_str(
                "请先运行 npm run desktop:dev 或 bash scripts/bootstrap-asr-venv.sh",
                "安装包内无需源码 venv，请使用「环境与 ASR」",
            )
        )
    })?;
    let asr_dir = repo.join("services/asr");
    if !asr_dir.join("pyproject.toml").is_file() {
        return Err(format!("ASR 目录无效：{}", asr_dir.display()));
    }

    kill_loopback_listeners_on_port(ASR_LOOPBACK_PORT)?;
    std::thread::sleep(Duration::from_millis(300));

    let models = models_root_for_app_data_root(&st.root);
    let hub = read_hub_model_pref(st);
    let language = read_language_pref(st);
    let expected_hub = hub.clone();

    let log_path = dev_asr_log_path();
    let log_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("无法写入侧车日志 {}：{e}", log_path.display()))?;

    let mut cmd = Command::new(&python);
    cmd.current_dir(&asr_dir)
        .arg("-m")
        .arg("rushi_asr")
        .stdin(Stdio::null())
        .stdout(Stdio::from(
            log_file.try_clone().map_err(|e| e.to_string())?,
        ))
        .stderr(Stdio::from(log_file));
    apply_asr_model_env(&mut cmd, &models, hub.as_deref(), Some(language.as_str()));
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    append_source_log(app, &format!("INFO source_asr_spawn {}", python.display()));
    cmd.spawn().map_err(|e| format!("无法启动源码侧车：{e}"))?;

    let attempts = (HEALTH_WAIT_MS / HEALTH_POLL_MS) as usize;
    for _ in 0..attempts {
        std::thread::sleep(Duration::from_millis(HEALTH_POLL_MS));
        if !bundled_health_looks_like_rushi_asr() {
            continue;
        }
        if health_declares_local_token_required(
            &fetch_health_json().unwrap_or(serde_json::Value::Null),
        ) {
            return Err(dev_or_packaged_str(
                "8741 侧车仍要求 local token（可能是旧 bundled 进程）。请完全退出应用后重新 npm run desktop:dev。",
                "8741 侧车仍要求 local token（可能是旧进程）。请完全退出应用后重新打开，或在「环境与 ASR」点「重试内置侧车」。",
            )
            .into());
        }
        if let Some(expected) = expected_hub.as_deref() {
            if fetch_health_model_id().as_deref() == Some(expected) {
                append_source_log(app, "INFO source_asr_health_ok");
                eprintln!("[rushi-asr-sidecar] source ASR ready at {ASR_HEALTH_URL}");
                return Ok(());
            }
        } else if bundled_health_looks_like_rushi_asr() {
            append_source_log(app, "INFO source_asr_health_ok");
            return Ok(());
        }
    }

    Err(format!(
        "源码侧车启动后未在 {} 内就绪。请查看 {}；{}",
        format_duration_ms(HEALTH_WAIT_MS),
        log_path.display(),
        dev_or_packaged_str(
            "并查看终端 npm run desktop:dev 输出。",
            "或在「环境与 ASR」点「重试内置侧车」。",
        )
    ))
}

fn fetch_health_json() -> Option<serde_json::Value> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .ok()?;
    let resp = client.get(ASR_HEALTH_URL).send().ok()?;
    if !resp.status().is_success() {
        return None;
    }
    resp.json().ok()
}

fn format_duration_ms(ms: u64) -> String {
    if ms >= 60_000 {
        format!("{} 秒", ms / 1000)
    } else {
        format!("{ms} ms")
    }
}

fn append_source_log(app: &AppHandle, line: &str) {
    if let Some(st) = app.try_state::<DbState>() {
        crate::project::utils::append_desktop_log_line(st.inner(), line);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_repo_root_from_manifest_dir() {
        let root = resolve_rushi_repo_root().expect("repo root in dev tree");
        assert!(root.join("services/asr/pyproject.toml").is_file());
    }
}

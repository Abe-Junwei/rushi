use super::utils::append_desktop_log_line;
use crate::asr_sidecar;
use crate::DbState;
use std::ops::Deref;
use std::path::Path;
use tauri::State;

fn run_funasr_install_script(repo_root: &Path) -> Result<String, String> {
    use std::process::Command;
    let script = repo_root.join("scripts/install-funasr-for-desktop.sh");
    if !script.is_file() {
        return Err(format!("未找到安装脚本：{}", script.display()));
    }
    let out = Command::new("bash")
        .arg(&script)
        .current_dir(repo_root)
        .output()
        .map_err(|e| format!("无法执行 bash：{e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
    if !out.status.success() {
        return Err(format!(
            "安装脚本失败（退出码 {:?}）。\n--- stderr ---\n{stderr}\n--- stdout ---\n{stdout}",
            out.status.code()
        ));
    }
    Ok(format!("{stdout}\n{stderr}"))
}

/// 选择 Rushi 仓库根目录后，在 `services/asr/.venv` 中执行 `pip install -e ".[funasr]"`（耗网络与磁盘）。
#[tauri::command]
pub fn install_funasr_deps_interactive(state: State<DbState>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = state;
        return Err(
            "当前版本仅在 macOS / Linux 支持从应用内一键安装；Windows 请按 services/asr/README.md 手动配置 venv 与 pip。"
                .into(),
        );
    }
    #[cfg(not(target_os = "windows"))]
    {
        let st: &DbState = state.deref();
        let picked = rfd::FileDialog::new()
            .set_title("选择 Rushi 源代码仓库根目录（内含 services/asr 与 scripts）")
            .pick_folder();
        let Some(root) = picked else {
            return Ok(None);
        };
        let marker = root.join("services/asr/pyproject.toml");
        if !marker.is_file() {
            return Err(format!(
                "所选目录不是有效的 Rushi 仓库根目录：未找到 {}",
                marker.display()
            ));
        }
        let log = run_funasr_install_script(&root)?;
        append_desktop_log_line(st, "INFO funasr_deps_install_script_ok");
        Ok(Some(log))
    }
}

/// 结束由壳拉起的 bundled 侧车（若有）并再次尝试启动（8741 空闲时）。
#[tauri::command]
pub async fn retry_bundled_asr_sidecar(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let st = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || asr_sidecar::restart_loopback_asr(&app, &st))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(unix)]
pub(crate) fn kill_loopback_listeners_on_port(port: u16) -> Result<(), String> {
    use std::process::Command;
    use std::time::Duration;
    let port_arg = format!(":{port}");
    let pids = Command::new("lsof")
        .args(["-ti", &port_arg])
        .output()
        .map_err(|e| format!("无法执行 lsof：{e}"))?;
    let stdout = String::from_utf8_lossy(&pids.stdout);
    if stdout.trim().is_empty() {
        return Ok(());
    }
    for pid in stdout.split_whitespace() {
        let _ = Command::new("kill").arg(pid).status();
    }
    std::thread::sleep(Duration::from_millis(400));
    let pids = Command::new("lsof")
        .args(["-ti", &port_arg])
        .output()
        .map_err(|e| format!("无法执行 lsof：{e}"))?;
    let stdout = String::from_utf8_lossy(&pids.stdout);
    for pid in stdout.split_whitespace() {
        let _ = Command::new("kill").args(["-9", pid]).status();
    }
    Ok(())
}

#[cfg(windows)]
pub(crate) fn kill_loopback_listeners_on_port(port: u16) -> Result<(), String> {
    use std::process::Command;
    use std::time::Duration;

    let script = format!(
        r#"$ErrorActionPreference = 'SilentlyContinue'
$listenPids = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort {port} -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $listenPids) {{
  if ($procId -and $procId -ne $PID) {{
    Stop-Process -Id $procId -ErrorAction SilentlyContinue
  }}
}}
Start-Sleep -Milliseconds 400
$remainingPids = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort {port} -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $remainingPids) {{
  if ($procId -and $procId -ne $PID) {{
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }}
}}
"#,
    );
    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        &script,
    ]);
    crate::utils::no_console_window(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("无法执行 PowerShell 清理 {port} 端口：{e}"))?;
    if !output.status.success() {
        return Err(format!(
            "自动结束占用 {port} 的侧车进程失败：{}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    std::thread::sleep(Duration::from_millis(100));
    Ok(())
}

#[cfg(not(any(unix, windows)))]
pub(crate) fn kill_loopback_listeners_on_port(port: u16) -> Result<(), String> {
    Err(format!("当前平台暂不支持自动结束占用 {port} 的侧车进程"))
}

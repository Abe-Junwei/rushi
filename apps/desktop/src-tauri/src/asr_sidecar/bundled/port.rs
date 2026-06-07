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

#[cfg(not(unix))]
pub(crate) fn kill_loopback_listeners_on_port(port: u16) -> Result<(), String> {
    let _ = port;
    Err("当前平台暂不支持自动结束占用 8741 的侧车进程".into())
}

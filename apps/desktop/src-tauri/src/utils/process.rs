//! Cross-platform process-spawn hardening.
//!
//! On Windows, launching a console-subsystem binary (ffmpeg, ffprobe, icacls,
//! curl, python, …) from a GUI app makes the OS allocate a `conhost` console,
//! which flashes a black window that closes itself. It appears on any code path
//! that shells out — including the hot segment-save path (ffprobe for duration),
//! so users see it flash on ordinary edits. `CREATE_NO_WINDOW` suppresses it.
//!
//! This is the single source of truth: every `std::process::Command` that runs a
//! console tool must go through here so the flag can't drift out of sync again.

use std::process::Command;

/// Windows `CREATE_NO_WINDOW` process-creation flag.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Suppress the transient console window for a console-subsystem child process.
/// No-op on non-Windows platforms.
pub fn no_console_window(cmd: &mut Command) -> &mut Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

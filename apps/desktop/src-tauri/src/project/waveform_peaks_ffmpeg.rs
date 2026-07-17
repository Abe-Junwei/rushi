//! FFmpeg remux fallback when Symphonia cannot probe/decode the source container.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

/// Floor for hang-prone remux; long files use a derived budget via
/// [`remux_audio_to_pcm_wav_with_timeout`].
pub const FFMPEG_REMUX_TIMEOUT_MIN: Duration = Duration::from_secs(120);
pub const FFMPEG_REMUX_TIMEOUT_MAX: Duration = Duration::from_secs(7200);

/// Channel layout for remuxed PCM WAV.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemuxChannelMode {
    /// Peaks path: force mono for consistent LOD generation.
    Mono,
    /// Project-audio normalize: keep source channel count.
    Preserve,
}

pub fn resolve_ffmpeg_command() -> PathBuf {
    crate::bundled_asr_assets::resolve_bundled_ffmpeg()
}

pub fn symphonia_error_eligible_for_ffmpeg_remux(err: &str) -> bool {
    let lower = err.to_ascii_lowercase();
    lower.contains("探测音频格式失败")
        || lower.contains("探测音频失败")
        || lower.contains("riff")
        || lower.contains("malformed")
        || lower.contains("创建解码器失败")
        || lower.contains("无法读取采样率")
        || lower.contains("音频无可用轨道")
}

/// Remux to mono PCM WAV (peaks generation).
pub fn remux_audio_to_pcm_wav(source: &Path, dest: &Path) -> Result<(), String> {
    let timeout = crate::project::audio_container_normalize::ffmpeg_remux_timeout_for(source);
    remux_audio_to_pcm_wav_with_options(source, dest, timeout, RemuxChannelMode::Mono)
}

pub fn remux_audio_to_pcm_wav_with_options(
    source: &Path,
    dest: &Path,
    timeout: Duration,
    channels: RemuxChannelMode,
) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建 remux 目录失败: {e}"))?;
    }
    let ffmpeg = resolve_ffmpeg_command();
    let source_s = source.to_str().ok_or_else(|| "音频路径无效".to_string())?;
    let dest_s = dest
        .to_str()
        .ok_or_else(|| "remux 输出路径无效".to_string())?;

    let timeout = timeout.clamp(FFMPEG_REMUX_TIMEOUT_MIN, FFMPEG_REMUX_TIMEOUT_MAX);

    let mut args: Vec<&str> = vec![
        "-y",
        "-nostdin",
        "-loglevel",
        "error",
        "-fflags",
        "+discardcorrupt+genpts",
        "-err_detect",
        "ignore_err",
        "-i",
        source_s,
        "-vn",
    ];
    if channels == RemuxChannelMode::Mono {
        args.extend_from_slice(&["-ac", "1"]);
    }
    args.extend_from_slice(&["-c:a", "pcm_s16le", dest_s]);

    let mut cmd = Command::new(&ffmpeg);
    cmd.args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    crate::utils::no_console_window(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| format!("启动 ffmpeg 失败: {e}"))?;

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("ffmpeg remux 超时（{} 秒）", timeout.as_secs()));
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("等待 ffmpeg 失败: {e}")),
        }
    };

    let mut stderr_buf = Vec::new();
    if let Some(mut pipe) = child.stderr.take() {
        let _ = pipe.read_to_end(&mut stderr_buf);
    }

    if !status.success() {
        let stderr = String::from_utf8_lossy(&stderr_buf);
        let detail = stderr.trim();
        if detail.is_empty() {
            return Err("ffmpeg remux 失败".to_string());
        }
        return Err(format!("ffmpeg remux 失败: {detail}"));
    }

    if !dest.is_file() {
        return Err("ffmpeg remux 未生成输出文件".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn symphonia_riff_probe_errors_are_remux_eligible() {
        assert!(symphonia_error_eligible_for_ffmpeg_remux(
            "探测音频格式失败: malformed stream: riff: chunk length exceeds parent"
        ));
        assert!(symphonia_error_eligible_for_ffmpeg_remux(
            "探测音频失败: malformed stream: riff: chunk length exceeds parent (list)"
        ));
        assert!(!symphonia_error_eligible_for_ffmpeg_remux(
            "peaks 解码不完整（10.0s / 容器 120.0s），已中止写入"
        ));
    }
}

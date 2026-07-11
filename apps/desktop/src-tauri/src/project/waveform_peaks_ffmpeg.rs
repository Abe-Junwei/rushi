//! FFmpeg remux fallback when Symphonia cannot probe/decode the source container.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

/// Hang-prone remux must not block peaks generation forever.
const FFMPEG_REMUX_TIMEOUT: Duration = Duration::from_secs(120);

pub fn resolve_ffmpeg_command() -> PathBuf {
    crate::bundled_asr_assets::resolve_bundled_ffmpeg()
}

pub fn symphonia_error_eligible_for_ffmpeg_remux(err: &str) -> bool {
    let lower = err.to_ascii_lowercase();
    lower.contains("探测音频格式失败")
        || lower.contains("riff")
        || lower.contains("创建解码器失败")
        || lower.contains("无法读取采样率")
        || lower.contains("音频无可用轨道")
}

/// Remux any decodable input to mono PCM WAV for Symphonia peaks generation.
pub fn remux_audio_to_pcm_wav(source: &Path, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建 remux 目录失败: {e}"))?;
    }
    let ffmpeg = resolve_ffmpeg_command();
    let source_s = source.to_str().ok_or_else(|| "音频路径无效".to_string())?;
    let dest_s = dest
        .to_str()
        .ok_or_else(|| "remux 输出路径无效".to_string())?;

    let mut child = Command::new(&ffmpeg)
        .args([
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
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            dest_s,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 ffmpeg 失败: {e}"))?;

    let deadline = Instant::now() + FFMPEG_REMUX_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("ffmpeg remux 超时（120 秒）".to_string());
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
        assert!(!symphonia_error_eligible_for_ffmpeg_remux(
            "peaks 解码不完整（10.0s / 容器 120.0s），已中止写入"
        ));
    }
}

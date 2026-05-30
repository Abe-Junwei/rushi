//! FFmpeg remux fallback when Symphonia cannot probe/decode the source container.

use std::path::{Path, PathBuf};
use std::process::Command;

fn bundled_ffmpeg_candidates() -> Vec<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut candidates = Vec::new();
    for onedir in ["rushi-asr-sidecar", "rushi-asr-sidecar-cuda"] {
        let internal = manifest_dir
            .join("resources")
            .join("bundled-asr")
            .join(onedir)
            .join("_internal");
        #[cfg(target_os = "windows")]
        let ffmpeg = internal.join("ffmpeg.exe");
        #[cfg(not(target_os = "windows"))]
        let ffmpeg = internal.join("ffmpeg");
        if ffmpeg.is_file() {
            candidates.push(ffmpeg);
        }
    }
    candidates
}

pub fn resolve_ffmpeg_command() -> PathBuf {
    for candidate in bundled_ffmpeg_candidates() {
        return candidate;
    }
    PathBuf::from("ffmpeg")
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
    let source_s = source
        .to_str()
        .ok_or_else(|| "音频路径无效".to_string())?;
    let dest_s = dest
        .to_str()
        .ok_or_else(|| "remux 输出路径无效".to_string())?;

    let output = Command::new(&ffmpeg)
        .args([
            "-y",
            "-nostdin",
            "-loglevel",
            "error",
            "-i",
            source_s,
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            dest_s,
        ])
        .output()
        .map_err(|e| format!("启动 ffmpeg 失败: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
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

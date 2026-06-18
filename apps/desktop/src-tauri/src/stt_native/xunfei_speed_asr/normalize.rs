//! ffmpeg 归一：16 kHz mono s16le WAV。

use std::path::{Path, PathBuf};
use std::process::Command;

use super::super::read_audio_bytes_limited;

pub fn resolve_ffmpeg_command() -> PathBuf {
    crate::bundled_asr_assets::resolve_bundled_ffmpeg()
}

pub fn normalize_to_wav_16k_mono(source: &Path, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建临时目录失败: {e}"))?;
    }
    let ffmpeg = resolve_ffmpeg_command();
    let source_s = source
        .to_str()
        .ok_or_else(|| "音频路径无效".to_string())?;
    let dest_s = dest
        .to_str()
        .ok_or_else(|| "输出路径无效".to_string())?;

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
            "-ar",
            "16000",
            "-sample_fmt",
            "s16",
            dest_s,
        ])
        .output()
        .map_err(|e| format!("启动 ffmpeg 失败: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let detail = stderr.trim();
        if detail.is_empty() {
            return Err("ffmpeg 归一失败".to_string());
        }
        return Err(format!("ffmpeg 归一失败: {detail}"));
    }
    if !dest.is_file() {
        return Err("ffmpeg 未生成输出文件".to_string());
    }
    Ok(())
}

pub fn prepare_upload_wav(source: &Path, work_dir: &Path) -> Result<PathBuf, String> {
    let _ = read_audio_bytes_limited(source)?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(ext.as_str(), "wav" | "pcm") {
        return Ok(source.to_path_buf());
    }
    let dest = work_dir.join("xunfei_normalized.wav");
    normalize_to_wav_16k_mono(source, &dest)?;
    Ok(dest)
}

//! ffmpeg 归一：16 kHz mono s16le WAV。

use std::path::{Path, PathBuf};
use std::process::Command;

use super::super::audio_size_within_limit;

pub fn resolve_ffmpeg_command() -> PathBuf {
    crate::bundled_asr_assets::resolve_bundled_ffmpeg()
}

pub fn normalize_to_wav_16k_mono(source: &Path, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建临时目录失败: {e}"))?;
    }
    let ffmpeg = resolve_ffmpeg_command();
    let source_s = source.to_str().ok_or_else(|| "音频路径无效".to_string())?;
    let dest_s = dest.to_str().ok_or_else(|| "输出路径无效".to_string())?;

    let mut cmd = Command::new(&ffmpeg);
    cmd.args([
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
    ]);
    crate::utils::no_console_window(&mut cmd);
    let output = cmd.output().map_err(|e| format!("启动 ffmpeg 失败: {e}"))?;

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

/// 仅 `.pcm`（无头裸流，必须由用户保证 16k/16bit/mono）可直传；
/// 其余格式（含 `.wav`，因其采样率/声道未知）一律经 ffmpeg 归一为 16k mono s16，
/// 避免向讯飞声明 `audio/L16;rate=16000` 与实际不符触发 20304/10043。
fn passthrough_without_normalize(ext: &str) -> bool {
    ext == "pcm"
}

pub fn prepare_upload_wav(source: &Path, work_dir: &Path) -> Result<PathBuf, String> {
    audio_size_within_limit(source)?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if passthrough_without_normalize(&ext) {
        return Ok(source.to_path_buf());
    }
    let dest = work_dir.join("xunfei_normalized.wav");
    normalize_to_wav_16k_mono(source, &dest)?;
    Ok(dest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_pcm_passes_through() {
        assert!(passthrough_without_normalize("pcm"));
        // wav 采样率/声道未知，必须归一
        assert!(!passthrough_without_normalize("wav"));
        assert!(!passthrough_without_normalize("mp3"));
        assert!(!passthrough_without_normalize("m4a"));
        assert!(!passthrough_without_normalize("mp4"));
        assert!(!passthrough_without_normalize(""));
    }
}

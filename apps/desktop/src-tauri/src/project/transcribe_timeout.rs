//! Local FunASR transcribe HTTP timeout budget (R3e-A).

use std::path::Path;
use std::process::Command;
use std::time::Duration;

pub const LOCAL_TRANSCRIBE_TIMEOUT_MIN_SEC: u64 = 600;
pub const LOCAL_TRANSCRIBE_TIMEOUT_MAX_SEC: u64 = 7200;
const PER_DURATION_FACTOR: f64 = 4.0;
const FIXED_PADDING_SEC: u64 = 300;
pub const LONG_AUDIO_HINT_THRESHOLD_SEC: f64 = 30.0 * 60.0;

pub fn local_transcribe_timeout_secs(audio_duration_sec: Option<f64>) -> u64 {
    let Some(duration) = audio_duration_sec.filter(|d| d.is_finite() && *d > 0.0) else {
        return LOCAL_TRANSCRIBE_TIMEOUT_MIN_SEC;
    };
    let estimate = (duration * PER_DURATION_FACTOR).ceil() as u64 + FIXED_PADDING_SEC;
    estimate.clamp(LOCAL_TRANSCRIBE_TIMEOUT_MIN_SEC, LOCAL_TRANSCRIBE_TIMEOUT_MAX_SEC)
}

pub fn local_transcribe_timeout_duration(audio_duration_sec: Option<f64>) -> Duration {
    Duration::from_secs(local_transcribe_timeout_secs(audio_duration_sec))
}

pub fn long_audio_transcribe_hint(audio_duration_sec: Option<f64>) -> Option<&'static str> {
    audio_duration_sec
        .filter(|d| *d > LONG_AUDIO_HINT_THRESHOLD_SEC)
        .map(|_| {
            "音频超过 30 分钟：本机转写可能耗时较久。请保持应用开启并避免同时占用大量内存；Apple Silicon 可在启动侧车前设置 RUSHI_FUNASR_DEVICE=mps 以加速。"
        })
}

pub fn probe_audio_duration_sec(path: &Path) -> Option<f64> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path.to_str()?,
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("N/A") {
        return None;
    }
    trimmed.parse::<f64>().ok().filter(|d| d.is_finite() && *d > 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_clamps_to_minimum() {
        assert_eq!(local_transcribe_timeout_secs(None), 600);
        assert_eq!(local_transcribe_timeout_secs(Some(30.0)), 600);
    }

    #[test]
    fn timeout_scales_and_caps() {
        assert_eq!(local_transcribe_timeout_secs(Some(50.0 * 60.0)), 7200);
        assert_eq!(local_transcribe_timeout_secs(Some(10.0 * 60.0)), 2700);
    }

    #[test]
    fn long_audio_hint_threshold() {
        assert!(long_audio_transcribe_hint(Some(31.0 * 60.0)).is_some());
        assert!(long_audio_transcribe_hint(Some(10.0 * 60.0)).is_none());
    }
}

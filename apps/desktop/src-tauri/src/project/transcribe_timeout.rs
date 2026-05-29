//! Local FunASR transcribe HTTP timeout budget (R3e-A).

use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
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

fn bundled_ffprobe_candidates() -> Vec<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut candidates = Vec::new();
    for onedir in ["rushi-asr-sidecar", "rushi-asr-sidecar-cuda"] {
        let internal = manifest_dir
            .join("resources")
            .join("bundled-asr")
            .join(onedir)
            .join("_internal");
        #[cfg(target_os = "windows")]
        let probe = internal.join("ffprobe.exe");
        #[cfg(not(target_os = "windows"))]
        let probe = internal.join("ffprobe");
        if probe.is_file() {
            candidates.push(probe);
        }
    }
    candidates
}

fn resolve_ffprobe_command() -> PathBuf {
    for candidate in bundled_ffprobe_candidates() {
        return candidate;
    }
    PathBuf::from("ffprobe")
}

pub fn probe_audio_duration_sec(path: &Path) -> Option<f64> {
    let ffprobe = resolve_ffprobe_command();
    let ffprobe_owned = ffprobe.clone();
    let path_arg = path.to_str()?.to_string();
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    thread::spawn(move || {
        let result = Command::new(&ffprobe_owned)
            .args([
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                &path_arg,
            ])
            .output();
        let _ = tx.send(result);
    });
    let deadline = std::time::Instant::now() + Duration::from_secs(30);
    loop {
        match rx.try_recv() {
            Ok(Ok(output)) => {
                if !output.status.success() {
                    return None;
                }
                let raw = String::from_utf8_lossy(&output.stdout);
                let trimmed = raw.trim();
                if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("N/A") {
                    return None;
                }
                return trimmed
                    .parse::<f64>()
                    .ok()
                    .filter(|d| d.is_finite() && *d > 0.0);
            }
            Ok(Err(_)) => return None,
            Err(std::sync::mpsc::TryRecvError::Empty) => {
                if std::time::Instant::now() >= deadline {
                    return None;
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => return None,
        }
    }
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

    #[test]
    fn resolve_ffprobe_prefers_bundled_when_present() {
        let bundled = bundled_ffprobe_candidates();
        let resolved = resolve_ffprobe_command();
        if let Some(first) = bundled.first() {
            assert_eq!(resolved, *first);
        } else {
            assert_eq!(resolved, PathBuf::from("ffprobe"));
        }
    }
}

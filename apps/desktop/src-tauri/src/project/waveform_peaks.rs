//! Stream audio through symphonia and write audiowaveform-compatible `.dat` peaks.

use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// LOD levels aligned with BBC audiowaveform `--pixels-per-second`.
pub const PEAK_LEVELS: [(u8, u32); 4] = [(0, 2), (1, 20), (2, 200), (3, 800)];


#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PeaksAudioFingerprint {
    pub size_bytes: u64,
    pub mtime_ms: u128,
}

#[derive(Debug, Clone)]
pub struct PeaksGenerationReport {
    pub sample_rate: u32,
    pub duration_sec: f64,
    pub generated_levels: Vec<u8>,
    pub audio_fingerprint: Option<PeaksAudioFingerprint>,
}

/// Absolute duration tolerance when comparing peaks vs probed / media duration.
pub const PEAKS_DURATION_TOLERANCE_SEC: f64 = 1.5;
/// Regenerate when cached peaks cover less than this fraction of reference duration.
pub const PEAKS_DURATION_MIN_COVERAGE_RATIO: f64 = 0.98;

pub fn peaks_dir(project_dir: &Path) -> PathBuf {
    project_dir.join("peaks")
}

pub fn peak_file_path(peaks_root: &Path, file_id: &str, level: u8) -> PathBuf {
    peaks_root.join(format!("{file_id}_L{level}.dat"))
}

pub fn peak_meta_path(peaks_root: &Path, file_id: &str) -> PathBuf {
    peaks_root.join(format!("{file_id}.meta.json"))
}

fn peak_lock_path(peaks_root: &Path, file_id: &str) -> PathBuf {
    peaks_root.join(format!("{file_id}.generating.lock"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PeaksMetaFile {
    sample_rate: u32,
    duration_sec: f64,
    generated_levels: Vec<u8>,
    #[serde(default)]
    audio_size_bytes: Option<u64>,
    #[serde(default)]
    audio_mtime_ms: Option<u128>,
}

pub(crate) struct PeaksGenerationLock {
    path: PathBuf,
    _file: File,
}

impl Drop for PeaksGenerationLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

pub fn try_acquire_peaks_lock(peaks_root: &Path, file_id: &str) -> Result<Option<PeaksGenerationLock>, String> {
    fs::create_dir_all(peaks_root).map_err(|e| e.to_string())?;
    let path = peak_lock_path(peaks_root, file_id);
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
    {
        Ok(file) => Ok(Some(PeaksGenerationLock { path, _file: file })),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(None),
        Err(e) => Err(format!("peaks 锁失败: {e}")),
    }
}

pub fn write_peaks_meta(
    peaks_root: &Path,
    file_id: &str,
    report: &PeaksGenerationReport,
) -> Result<(), String> {
    let path = peak_meta_path(peaks_root, file_id);
    let (audio_size_bytes, audio_mtime_ms) = match report.audio_fingerprint {
        Some(fp) => (Some(fp.size_bytes), Some(fp.mtime_ms)),
        None => (None, None),
    };
    let meta = PeaksMetaFile {
        sample_rate: report.sample_rate,
        duration_sec: report.duration_sec,
        generated_levels: report.generated_levels.clone(),
        audio_size_bytes,
        audio_mtime_ms,
    };
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_peaks_meta(peaks_root: &Path, file_id: &str) -> Option<PeaksGenerationReport> {
    let path = peak_meta_path(peaks_root, file_id);
    let data = fs::read_to_string(&path).ok()?;
    let meta: PeaksMetaFile = serde_json::from_str(&data).ok()?;
    Some(PeaksGenerationReport {
        sample_rate: meta.sample_rate,
        duration_sec: meta.duration_sec,
        generated_levels: meta.generated_levels,
        audio_fingerprint: match (meta.audio_size_bytes, meta.audio_mtime_ms) {
            (Some(size_bytes), Some(mtime_ms)) => Some(PeaksAudioFingerprint {
                size_bytes,
                mtime_ms,
            }),
            _ => None,
        },
    })
}

/// Fingerprint the on-disk audio file (size + modified time).
pub fn audio_file_fingerprint(audio_path: &Path) -> Result<PeaksAudioFingerprint, String> {
    let meta = fs::metadata(audio_path).map_err(|e| format!("读取音频元数据失败: {e}"))?;
    let size_bytes = meta.len();
    let mtime_ms = meta
        .modified()
        .map_err(|e| format!("读取音频修改时间失败: {e}"))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("音频修改时间无效: {e}"))?
        .as_millis();
    Ok(PeaksAudioFingerprint {
        size_bytes,
        mtime_ms,
    })
}

fn read_dat_header(path: &Path) -> Option<(u32, u64, u64)> {
    let data = fs::read(path).ok()?;
    if data.len() < 24 {
        return None;
    }
    let sample_rate = i32::from_le_bytes(data[8..12].try_into().ok()?) as u32;
    let spp = i32::from_le_bytes(data[12..16].try_into().ok()?) as u64;
    let length = i32::from_le_bytes(data[16..20].try_into().ok()?) as u64;
    if sample_rate == 0 || spp == 0 || length == 0 {
        return None;
    }
    Some((sample_rate, spp, length))
}

/// Duration encoded in a single `.dat` LOD file.
pub fn dat_file_duration_sec(path: &Path) -> Option<f64> {
    let (sample_rate, spp, length) = read_dat_header(path)?;
    if sample_rate == 0 {
        return None;
    }
    Some((length * spp) as f64 / sample_rate as f64)
}

/// All LOD `.dat` files must encode the same timeline duration (within tolerance).
pub fn peak_levels_duration_consistent(peaks_root: &Path, file_id: &str) -> bool {
    let mut durations: Vec<f64> = Vec::new();
    for (level, _) in PEAK_LEVELS {
        let path = peak_file_path(peaks_root, file_id, level);
        if !path.is_file() {
            return false;
        }
        let Some(dur) = dat_file_duration_sec(&path) else {
            return false;
        };
        durations.push(dur);
    }
    let max = durations.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let min = durations.iter().copied().fold(f64::INFINITY, f64::min);
    if max <= 0.0 {
        return false;
    }
    (max - min).abs() <= PEAKS_DURATION_TOLERANCE_SEC
        || min / max >= PEAKS_DURATION_MIN_COVERAGE_RATIO
}

#[derive(Debug, Clone, Copy)]
pub struct PeaksStaleCheckOptions {
    pub reference_media_duration_sec: Option<f64>,
    pub probed_audio_duration_sec: Option<f64>,
}

pub fn duration_covers_reference(peaks_sec: f64, reference_sec: f64) -> bool {
    if !(peaks_sec.is_finite() && reference_sec.is_finite()) || reference_sec <= 0.0 {
        return true;
    }
    if peaks_sec / reference_sec >= PEAKS_DURATION_MIN_COVERAGE_RATIO {
        return true;
    }
    (reference_sec - peaks_sec).abs() <= PEAKS_DURATION_TOLERANCE_SEC
}

/// Returns `true` when cached peaks must be regenerated for `audio_path`.
pub fn peaks_cache_is_stale(
    peaks_root: &Path,
    file_id: &str,
    audio_path: &Path,
    opts: PeaksStaleCheckOptions,
) -> Result<bool, String> {
    if !all_peak_levels_exist(peaks_root, file_id) {
        return Ok(true);
    }
    if !peak_levels_duration_consistent(peaks_root, file_id) {
        return Ok(true);
    }

    let current_fp = audio_file_fingerprint(audio_path)?;
    let Some(report) = load_peaks_meta(peaks_root, file_id) else {
        return Ok(true);
    };

    if let Some(stored_fp) = report.audio_fingerprint {
        if stored_fp.size_bytes != current_fp.size_bytes || stored_fp.mtime_ms != current_fp.mtime_ms {
            return Ok(true);
        }
    } else {
        // Pre-fingerprint caches cannot be trusted — regenerate once to attach metadata.
        return Ok(true);
    }

    if let Some(reference_sec) = opts
        .reference_media_duration_sec
        .filter(|d| d.is_finite() && *d > 0.0)
    {
        if !duration_covers_reference(report.duration_sec, reference_sec) {
            return Ok(true);
        }
    }

    if let Some(probed_sec) = opts
        .probed_audio_duration_sec
        .filter(|d| d.is_finite() && *d > 0.0)
    {
        if !duration_covers_reference(report.duration_sec, probed_sec) {
            return Ok(true);
        }
    }

    Ok(false)
}


pub fn remove_peaks_for_file(peaks_root: &Path, file_id: &str) {
    for (level, _) in PEAK_LEVELS {
        let path = peak_file_path(peaks_root, file_id, level);
        let _ = fs::remove_file(path);
    }
    let _ = fs::remove_file(peak_meta_path(peaks_root, file_id));
    let _ = fs::remove_file(peak_lock_path(peaks_root, file_id));
}

pub fn peaks_disk_bytes_for_file(peaks_root: &Path, file_id: &str) -> u64 {
    let mut total = 0_u64;
    for (level, _) in PEAK_LEVELS {
        if let Ok(meta) = fs::metadata(peak_file_path(peaks_root, file_id, level)) {
            total = total.saturating_add(meta.len());
        }
    }
    if let Ok(meta) = fs::metadata(peak_meta_path(peaks_root, file_id)) {
        total = total.saturating_add(meta.len());
    }
    total
}

pub fn all_peak_levels_exist(peaks_root: &Path, file_id: &str) -> bool {
    PEAK_LEVELS
        .iter()
        .all(|(level, _)| peak_file_path(peaks_root, file_id, *level).is_file())
}

pub fn peaks_generation_in_progress(peaks_root: &Path, file_id: &str) -> bool {
    peak_lock_path(peaks_root, file_id).is_file()
}

/// Wait for another task to finish generating peaks (lock holder).
/// Timeout scales with media duration (capped) so long files are not treated as stuck.
pub fn wait_for_peaks_ready(
    peaks_root: &Path,
    file_id: &str,
    media_duration_sec: Option<f64>,
) -> Result<(), String> {
    let max_attempts = peaks_wait_max_attempts(media_duration_sec);
    let mut attempts = 0_u32;
    loop {
        if all_peak_levels_exist(peaks_root, file_id) {
            return Ok(());
        }
        if attempts >= max_attempts {
            return Err("等待 peaks 生成超时".to_string());
        }
        std::thread::sleep(Duration::from_millis(100));
        attempts += 1;
    }
}

fn peaks_wait_max_attempts(media_duration_sec: Option<f64>) -> u32 {
    const INTERVAL_MS: f64 = 100.0;
    let max_sec = media_duration_sec
        .filter(|d| d.is_finite() && *d > 0.0)
        .map(|d| (d * 0.35 + 60.0).min(900.0))
        .unwrap_or(120.0);
    ((max_sec * 1000.0) / INTERVAL_MS).ceil().max(1.0) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::waveform_peaks_generate::{generate_all_levels, LevelWriter};
    use std::io::Read;

    #[test]
    fn duration_covers_reference_allows_small_tail_gap_on_long_files() {
        let sample_rate = 44100_u32;
        let expected_frames = 128_699_136_u64;
        let decoded_frames = 128_694_528_u64;
        let expected_sec = expected_frames as f64 / sample_rate as f64;
        let actual_sec = decoded_frames as f64 / sample_rate as f64;
        assert!(duration_covers_reference(actual_sec, expected_sec));
    }

    #[test]
    fn dat_header_layout_matches_audiowaveform_v1() {
        let temp = std::env::temp_dir().join(format!("rushi-peaks-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let path = temp.join("test_L1.dat");

        let mut lw = LevelWriter::new(1, 20, 8000);
        lw.push_sample(0.5);
        lw.push_sample(-0.25);
        lw.finish();
        lw.write_dat(&path, 8000).unwrap();

        let mut f = File::open(&path).unwrap();
        let mut buf = [0u8; 24];
        f.read_exact(&mut buf).unwrap();
        let version = i32::from_le_bytes(buf[0..4].try_into().unwrap());
        let sample_rate = i32::from_le_bytes(buf[8..12].try_into().unwrap());
        let spp = i32::from_le_bytes(buf[12..16].try_into().unwrap());
        let length = i32::from_le_bytes(buf[16..20].try_into().unwrap());
        assert_eq!(version, 1);
        assert_eq!(sample_rate, 8000);
        assert_eq!(spp, 400);
        assert_eq!(length, 1);

        let _ = fs::remove_dir_all(temp);
    }

    #[test]
    fn generates_peaks_from_wav_fixture() {
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../fixtures/eval/samples/clear.wav");
        assert!(fixture.is_file(), "fixture missing: {}", fixture.display());
        let temp = std::env::temp_dir().join(format!("rushi-peaks-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let report = generate_all_levels(&fixture, &temp, "test-file").expect("generate peaks");
        assert!(report.duration_sec > 0.0);
        assert!(peak_file_path(&temp, "test-file", 1).is_file());
        let _ = fs::remove_dir_all(temp);
    }

    #[test]
    fn peaks_cache_is_stale_when_audio_file_changes() {
        let temp = std::env::temp_dir().join(format!("rushi-peaks-stale-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let audio = temp.join("audio.wav");
        fs::write(&audio, b"audio-v1").unwrap();

        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../fixtures/eval/samples/clear.wav");
        assert!(fixture.is_file(), "fixture missing: {}", fixture.display());
        let report = generate_all_levels(&fixture, &temp, "file-a").expect("generate peaks");

        let stale = peaks_cache_is_stale(
            &temp,
            "file-a",
            &audio,
            PeaksStaleCheckOptions {
                reference_media_duration_sec: None,
                probed_audio_duration_sec: None,
            },
        )
        .expect("stale check");
        assert!(stale, "fingerprint mismatch should invalidate cache");

        let fresh = peaks_cache_is_stale(
            &temp,
            "file-a",
            &fixture,
            PeaksStaleCheckOptions {
                reference_media_duration_sec: None,
                probed_audio_duration_sec: None,
            },
        )
        .expect("stale check");
        assert!(!fresh, "matching audio should keep cache");
        assert!(report.duration_sec > 0.0);

        let _ = fs::remove_dir_all(temp);
    }

    #[test]
    fn peaks_cache_is_stale_when_meta_has_no_fingerprint() {
        let temp = std::env::temp_dir().join(format!("rushi-peaks-legacy-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../fixtures/eval/samples/clear.wav");
        generate_all_levels(&fixture, &temp, "file-c").expect("generate peaks");

        let meta_path = peak_meta_path(&temp, "file-c");
        let legacy = r#"{"sample_rate":8000,"duration_sec":1.0,"generated_levels":[0,1,2]}"#;
        fs::write(&meta_path, legacy).unwrap();

        let stale = peaks_cache_is_stale(
            &temp,
            "file-c",
            &fixture,
            PeaksStaleCheckOptions {
                reference_media_duration_sec: None,
                probed_audio_duration_sec: None,
            },
        )
        .expect("stale check");
        assert!(stale, "legacy meta without fingerprint must regenerate");

        let _ = fs::remove_dir_all(temp);
    }

    #[test]
    fn peaks_cache_is_stale_when_shorter_than_media_reference() {
        let temp = std::env::temp_dir().join(format!("rushi-peaks-ratio-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../fixtures/eval/samples/clear.wav");
        generate_all_levels(&fixture, &temp, "file-b").expect("generate peaks");

        let stale = peaks_cache_is_stale(
            &temp,
            "file-b",
            &fixture,
            PeaksStaleCheckOptions {
                reference_media_duration_sec: Some(9999.0),
                probed_audio_duration_sec: None,
            },
        )
        .expect("stale check");
        assert!(stale, "peaks shorter than media reference must regenerate");

        let _ = fs::remove_dir_all(temp);
    }
}

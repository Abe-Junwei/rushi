//! Import/open audio container normalize: cheap WAV header repair → Symphonia gate → ffmpeg remux.
//! Research: docs/execution/specs/audio-import-container-normalize-research.md

use super::utils::append_desktop_log_line;
use super::waveform_peaks_ffmpeg::{
    remux_audio_to_pcm_wav_with_options, symphonia_error_eligible_for_ffmpeg_remux,
    RemuxChannelMode,
};
use crate::DbState;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

const WAVE_FORMAT_PCM: u16 = 1;
const WAVE_FORMAT_EXTENSIBLE: u16 = 0xFFFE;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizeReport {
    pub path: PathBuf,
    pub changed: bool,
    pub stage: &'static str,
}

/// Ensure `path` is Symphonia-probeable; may rewrite WAV headers or remux via ffmpeg.
/// Returns the final on-disk path (may change extension to `.wav` after remux).
///
/// Order: probe-first (healthy fast path) → L1 header sanitize → probe → L3 remux (preserve channels).
pub fn normalize_project_audio_in_place(
    path: &Path,
    log: Option<&DbState>,
) -> Result<NormalizeReport, String> {
    if !path.is_file() {
        return Err(format!("音频不存在: {}", path.display()));
    }

    let basename = path.file_name().and_then(|s| s.to_str()).unwrap_or("audio");

    let working = path.to_path_buf();

    // Fast path: already readable — do not open R/W or remux.
    if probe_symphonia_readable(&working).is_ok() {
        return Ok(NormalizeReport {
            path: working,
            changed: false,
            stage: "none",
        });
    }

    let mut changed = false;
    let mut stage: &'static str = "none";

    match try_sanitize_pcm_wav_headers(&working) {
        Ok(SanitizeOutcome::Fixed) => {
            changed = true;
            stage = "header";
            log_normalize(
                log,
                &format!("audio_normalize stage=header ok file={basename}"),
            );
        }
        Ok(SanitizeOutcome::Unchanged | SanitizeOutcome::NotApplicable) => {}
        Err(e) => {
            log_normalize(
                log,
                &format!("audio_normalize stage=header skip file={basename} err={e}"),
            );
        }
    }

    match probe_symphonia_readable(&working) {
        Ok(()) => {
            return Ok(NormalizeReport {
                path: working,
                changed,
                stage,
            });
        }
        Err(probe_err) => {
            if !symphonia_error_eligible_for_ffmpeg_remux(&probe_err) {
                return Err(format!("音频容器损坏且无法自动修复: {probe_err}"));
            }
            log_normalize(
                log,
                &format!("audio_normalize stage=remux start file={basename} cause={probe_err}"),
            );
        }
    }

    let parent = working.parent().ok_or_else(|| "音频路径无效".to_string())?;
    let tmp = parent.join(format!(
        "{}.normalize-tmp.wav",
        working
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("audio")
    ));
    let _ = fs::remove_file(&tmp);

    let timeout = ffmpeg_remux_timeout_for(&working);
    remux_audio_to_pcm_wav_with_options(&working, &tmp, timeout, RemuxChannelMode::Preserve)
        .map_err(|e| {
            let _ = fs::remove_file(&tmp);
            format!("音频容器损坏且自动修复失败（ffmpeg remux）: {e}")
        })?;

    if let Err(e) = probe_symphonia_readable(&tmp) {
        let _ = fs::remove_file(&tmp);
        return Err(format!(
            "音频容器损坏且自动修复失败（remux 后仍不可读）: {e}"
        ));
    }

    let final_path = if working
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("wav"))
    {
        working.clone()
    } else {
        working.with_extension("wav")
    };

    if final_path != tmp {
        fs::rename(&tmp, &final_path).map_err(|e| {
            let _ = fs::remove_file(&tmp);
            format!("写入规范化音频失败: {e}")
        })?;
    }
    if working != final_path && working.exists() {
        let _ = fs::remove_file(&working);
    }

    log_normalize(
        log,
        &format!(
            "audio_normalize stage=remux ok file={} timeout_s={}",
            final_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or(basename),
            timeout.as_secs()
        ),
    );

    Ok(NormalizeReport {
        path: final_path,
        changed: true,
        stage: "remux",
    })
}

/// Best-effort cleanup of a normalize attempt (original copy and possible `.wav` sibling).
pub fn cleanup_normalize_artifacts(original: &Path, normalized: Option<&Path>) {
    let _ = fs::remove_file(original);
    if let Some(p) = normalized {
        if p != original {
            let _ = fs::remove_file(p);
        }
    }
    if let Some(parent) = original.parent() {
        if let Some(stem) = original.file_stem().and_then(|s| s.to_str()) {
            let _ = fs::remove_file(parent.join(format!("{stem}.normalize-tmp.wav")));
            let wav = original.with_extension("wav");
            if wav != *original {
                let _ = fs::remove_file(&wav);
            }
        }
    }
}

fn log_normalize(log: Option<&DbState>, line: &str) {
    if let Some(st) = log {
        append_desktop_log_line(st, line);
    }
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum SanitizeOutcome {
    Fixed,
    Unchanged,
    NotApplicable,
}

/// Fix classic PCM WAVE `RIFF` / `data` sizes when `data` exceeds the RIFF parent (libsndfile-style).
pub(crate) fn try_sanitize_pcm_wav_headers(path: &Path) -> Result<SanitizeOutcome, String> {
    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| format!("打开音频失败: {e}"))?;
    let file_size = file
        .metadata()
        .map_err(|e| format!("读取音频元数据失败: {e}"))?
        .len();
    if file_size < 44 {
        return Ok(SanitizeOutcome::NotApplicable);
    }

    let mut header = [0u8; 12];
    file.read_exact(&mut header)
        .map_err(|e| format!("读取 RIFF 头失败: {e}"))?;
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Ok(SanitizeOutcome::NotApplicable);
    }

    let mut riff_size = u32::from_le_bytes(header[4..8].try_into().unwrap()) as u64;
    if riff_size == 0 {
        return Ok(SanitizeOutcome::NotApplicable);
    }

    // Cap declared RIFF end to file size (trailing garbage kept outside RIFF).
    let mut riff_end = 8 + riff_size;
    let mut need_riff_rewrite = false;
    if riff_end > file_size {
        riff_size = file_size.saturating_sub(8);
        riff_end = 8 + riff_size;
        need_riff_rewrite = true;
    }

    let mut pos = 12u64;
    let mut saw_pcm_fmt = false;
    let mut data_chunk_offset: Option<u64> = None;
    let mut data_size: u32 = 0;

    while pos + 8 <= riff_end && pos + 8 <= file_size {
        file.seek(SeekFrom::Start(pos))
            .map_err(|e| format!("seek 失败: {e}"))?;
        let mut chunk_hdr = [0u8; 8];
        if file.read_exact(&mut chunk_hdr).is_err() {
            break;
        }
        let id = &chunk_hdr[0..4];
        let size = u32::from_le_bytes(chunk_hdr[4..8].try_into().unwrap()) as u64;
        let payload_start = pos + 8;
        let payload_end = payload_start.saturating_add(size);

        if id == b"fmt " {
            if size < 16 || payload_end > file_size {
                return Ok(SanitizeOutcome::NotApplicable);
            }
            let mut fmt = vec![0u8; size as usize];
            file.read_exact(&mut fmt)
                .map_err(|e| format!("读取 fmt 失败: {e}"))?;
            let format_tag = u16::from_le_bytes(fmt[0..2].try_into().unwrap());
            saw_pcm_fmt = format_tag == WAVE_FORMAT_PCM
                || (format_tag == WAVE_FORMAT_EXTENSIBLE && size >= 40);
            if !saw_pcm_fmt {
                return Ok(SanitizeOutcome::NotApplicable);
            }
        } else if id == b"data" {
            data_chunk_offset = Some(pos);
            data_size = size as u32;
            break;
        }

        let mut next = payload_end;
        if size % 2 == 1 {
            next = next.saturating_add(1);
        }
        if next <= pos {
            break;
        }
        pos = next;
    }

    let Some(data_off) = data_chunk_offset else {
        return Ok(SanitizeOutcome::NotApplicable);
    };
    if !saw_pcm_fmt {
        return Ok(SanitizeOutcome::NotApplicable);
    }

    let data_payload_start = data_off + 8;
    let max_payload = riff_end
        .saturating_sub(data_payload_start)
        .min(file_size.saturating_sub(data_payload_start));
    if max_payload > u32::MAX as u64 {
        return Ok(SanitizeOutcome::NotApplicable);
    }
    let fixed_data_size = max_payload as u32;
    let data_end = data_payload_start.saturating_add(data_size as u64);
    let needs_data_fix =
        data_end > riff_end || data_end > file_size || (data_size as u64) > max_payload;

    if !need_riff_rewrite && !needs_data_fix {
        return Ok(SanitizeOutcome::Unchanged);
    }

    if need_riff_rewrite {
        let bytes = (riff_size as u32).to_le_bytes();
        file.seek(SeekFrom::Start(4))
            .map_err(|e| format!("seek RIFF size 失败: {e}"))?;
        file.write_all(&bytes)
            .map_err(|e| format!("写入 RIFF size 失败: {e}"))?;
    }
    if needs_data_fix {
        let bytes = fixed_data_size.to_le_bytes();
        file.seek(SeekFrom::Start(data_off + 4))
            .map_err(|e| format!("seek data size 失败: {e}"))?;
        file.write_all(&bytes)
            .map_err(|e| format!("写入 data size 失败: {e}"))?;
    }
    file.flush().map_err(|e| format!("flush 失败: {e}"))?;
    Ok(SanitizeOutcome::Fixed)
}

pub fn probe_symphonia_readable(path: &Path) -> Result<(), String> {
    let file = File::open(path).map_err(|e| format!("打开音频失败: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let format = symphonia::default::get_probe()
        .probe(
            &hint,
            mss,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .map_err(|e| format!("探测音频格式失败: {e}"))?;
    let track = format
        .default_track(TrackType::Audio)
        .ok_or_else(|| "音频无可用轨道".to_string())?;
    let audio = track
        .codec_params
        .as_ref()
        .and_then(|p| p.audio())
        .ok_or_else(|| "无法读取编解码参数".to_string())?;
    if audio.sample_rate.is_none() {
        return Err("无法读取采样率".to_string());
    }
    Ok(())
}

/// Remux wall-clock budget: ≥120s, ≤7200s; scales with duration and file size.
pub fn ffmpeg_remux_timeout_for(source: &Path) -> Duration {
    remux_timeout_secs(source)
        .map(Duration::from_secs)
        .unwrap_or(Duration::from_secs(120))
}

pub fn remux_timeout_secs(source: &Path) -> Option<u64> {
    const MIN: u64 = 120;
    const MAX: u64 = 7200;
    let meta_len = fs::metadata(source).ok()?.len();
    let from_size = meta_len / (2 * 1024 * 1024) + MIN;
    let from_dur = super::transcribe_timeout::probe_audio_duration_sec(source)
        .filter(|d| d.is_finite() && *d > 0.0)
        .map(|d| (d * 2.0).ceil() as u64 + MIN)
        .unwrap_or(from_size);
    Some(from_size.max(from_dur).clamp(MIN, MAX))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn test_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "rushi-audio-normalize-{label}-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_pcm_wav(path: &Path, payload_bytes: u32, riff_size: u32, data_size: u32) {
        let mut f = File::create(path).unwrap();
        f.write_all(b"RIFF").unwrap();
        f.write_all(&riff_size.to_le_bytes()).unwrap();
        f.write_all(b"WAVE").unwrap();
        f.write_all(b"fmt ").unwrap();
        f.write_all(&16u32.to_le_bytes()).unwrap();
        f.write_all(&1u16.to_le_bytes()).unwrap(); // PCM
        f.write_all(&1u16.to_le_bytes()).unwrap(); // mono
        f.write_all(&16_000u32.to_le_bytes()).unwrap();
        f.write_all(&(16_000u32 * 2).to_le_bytes()).unwrap();
        f.write_all(&2u16.to_le_bytes()).unwrap();
        f.write_all(&16u16.to_le_bytes()).unwrap();
        f.write_all(b"data").unwrap();
        f.write_all(&data_size.to_le_bytes()).unwrap();
        f.write_all(&vec![0u8; payload_bytes as usize]).unwrap();
    }

    #[test]
    fn sanitizes_data_size_exceeding_riff_parent() {
        let dir = test_dir("sanitize");
        let path = dir.join("bad.wav");
        let payload = 100u32;
        let riff_size = 4 + 24 + 8 + payload;
        write_pcm_wav(&path, payload, riff_size, 10_000);
        {
            let mut f = OpenOptions::new().append(true).open(&path).unwrap();
            f.write_all(&[0xABu8; 64]).unwrap();
        }

        assert!(probe_symphonia_readable(&path).is_err());
        assert_eq!(
            try_sanitize_pcm_wav_headers(&path).unwrap(),
            SanitizeOutcome::Fixed
        );
        probe_symphonia_readable(&path).expect("probe after header sanitize");
        assert_eq!(
            try_sanitize_pcm_wav_headers(&path).unwrap(),
            SanitizeOutcome::Unchanged
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn normalize_in_place_fixes_bad_wav_without_remux() {
        let dir = test_dir("normalize");
        let path = dir.join("clip.wav");
        let payload = 200u32;
        let riff_size = 4 + 24 + 8 + payload;
        write_pcm_wav(&path, payload, riff_size, 50_000);
        {
            let mut f = OpenOptions::new().append(true).open(&path).unwrap();
            f.write_all(&[0u8; 32]).unwrap();
        }
        let report = normalize_project_audio_in_place(&path, None).unwrap();
        assert!(report.changed);
        assert_eq!(report.stage, "header");
        assert_eq!(report.path, path);
        probe_symphonia_readable(&path).unwrap();
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn remux_timeout_secs_clamps_to_floor() {
        let dir = test_dir("timeout");
        let path = dir.join("tiny.wav");
        let payload = 32u32;
        let riff_size = 4 + 24 + 8 + payload;
        write_pcm_wav(&path, payload, riff_size, payload);
        let secs = remux_timeout_secs(&path).unwrap();
        assert!(secs >= 120);
        assert!(secs <= 7200);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn healthy_wav_unchanged_probe_first() {
        let dir = test_dir("healthy");
        let path = dir.join("ok.wav");
        let payload = 64u32;
        let riff_size = 4 + 24 + 8 + payload;
        write_pcm_wav(&path, payload, riff_size, payload);
        let report = normalize_project_audio_in_place(&path, None).unwrap();
        assert!(!report.changed);
        assert_eq!(report.stage, "none");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cleanup_normalize_artifacts_removes_wav_sibling() {
        let dir = test_dir("cleanup");
        let m4a = dir.join("clip.m4a");
        let wav = dir.join("clip.wav");
        fs::write(&m4a, b"x").unwrap();
        fs::write(&wav, b"y").unwrap();
        cleanup_normalize_artifacts(&m4a, Some(&wav));
        assert!(!m4a.exists());
        assert!(!wav.exists());
        let _ = fs::remove_dir_all(&dir);
    }
}

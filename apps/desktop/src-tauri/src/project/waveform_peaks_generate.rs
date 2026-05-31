use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use super::waveform_peaks::{
    audio_file_fingerprint, duration_covers_reference, peak_file_path, write_peaks_meta,
    PeaksGenerationReport, PEAK_LEVELS,
};

const DAT_VERSION: i32 = 1;
const DAT_FLAGS: i32 = 0;
const DAT_FORMAT_I16: i32 = 1;

pub(crate) struct LevelWriter {
    level: u8,
    samples_per_pixel: u64,
    pixels: Vec<(i16, i16)>,
    current_pixel: u64,
    sample_in_pixel: u64,
    cur_min: f32,
    cur_max: f32,
}

impl LevelWriter {
    pub(crate) fn new(level: u8, pixels_per_second: u32, sample_rate: u32) -> Self {
        // NOTE: integer division means the *actual* pixels-per-second encoded in the
        // .dat file is sample_rate / floor(sample_rate / pps). For sample rates that
        // do not divide evenly (e.g. 44100 / 200 = 220.5 → 220) the effective pps is
        // slightly higher (~200.45). The deviation is tiny (<0.3 %) and well inside
        // PEAKS_DURATION_TOLERANCE_SEC, so we keep it to stay compatible with the
        // audiowaveform v1 integer header format.
        let samples_per_pixel = (sample_rate as u64).max(1) / pixels_per_second as u64;
        Self {
            level,
            samples_per_pixel: samples_per_pixel.max(1),
            pixels: Vec::new(),
            current_pixel: 0,
            sample_in_pixel: 0,
            cur_min: f32::MAX,
            cur_max: f32::MIN,
        }
    }

    pub(crate) fn push_sample(&mut self, sample: f32) {
        if self.sample_in_pixel == 0 {
            self.cur_min = sample;
            self.cur_max = sample;
        } else {
            if sample < self.cur_min {
                self.cur_min = sample;
            }
            if sample > self.cur_max {
                self.cur_max = sample;
            }
        }
        self.sample_in_pixel += 1;
        if self.sample_in_pixel >= self.samples_per_pixel {
            self.flush_pixel();
        }
    }

    pub(crate) fn flush_pixel(&mut self) {
        if self.sample_in_pixel == 0 {
            return;
        }
        let min_i16 = float_to_i16(self.cur_min);
        let max_i16 = float_to_i16(self.cur_max);
        let idx = self.current_pixel as usize;
        if idx >= self.pixels.len() {
            self.pixels.push((min_i16, max_i16));
        } else {
            self.pixels[idx] = (min_i16, max_i16);
        }
        self.current_pixel += 1;
        self.sample_in_pixel = 0;
        self.cur_min = f32::MAX;
        self.cur_max = f32::MIN;
    }

    pub(crate) fn finish(&mut self) {
        if self.sample_in_pixel > 0 {
            self.flush_pixel();
        }
    }

    pub(crate) fn write_dat(&self, path: &Path, sample_rate: u32) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let tmp_path = path.with_extension("dat.tmp");
        let file = File::create(&tmp_path).map_err(|e| e.to_string())?;
        let mut w = BufWriter::new(file);
        let length = self.pixels.len() as i32;
        let samples_per_pixel = self.samples_per_pixel.min(i32::MAX as u64) as i32;
        write_i32(&mut w, DAT_VERSION)?;
        write_i32(&mut w, DAT_FLAGS)?;
        write_i32(&mut w, sample_rate as i32)?;
        write_i32(&mut w, samples_per_pixel)?;
        write_i32(&mut w, length)?;
        write_i32(&mut w, DAT_FORMAT_I16)?;
        for (min_v, max_v) in &self.pixels {
            write_i16(&mut w, *min_v)?;
            write_i16(&mut w, *max_v)?;
        }
        w.flush().map_err(|e| e.to_string())?;
        fs::rename(&tmp_path, path).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn float_to_i16(v: f32) -> i16 {
    (v.clamp(-1.0, 1.0) * 32767.0).round() as i16
}

fn write_i32(w: &mut BufWriter<File>, v: i32) -> Result<(), String> {
    w.write_all(&v.to_le_bytes()).map_err(|e| e.to_string())
}

fn write_i16(w: &mut BufWriter<File>, v: i16) -> Result<(), String> {
    w.write_all(&v.to_le_bytes()).map_err(|e| e.to_string())
}

fn codec_duration_sec(sample_rate: u32, n_frames: Option<u64>) -> Option<f64> {
    let frames = n_frames?;
    if sample_rate == 0 {
        return None;
    }
    Some(frames as f64 / sample_rate as f64)
}

/// Container/codec duration from a quick Symphonia probe (no full decode).
pub fn probe_symphonia_track_duration_sec(audio_path: &Path) -> Option<f64> {
    let file = File::open(audio_path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = audio_path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .ok()?;
    let track = probed.format.default_track()?;
    let params = track.codec_params.clone();
    codec_duration_sec(params.sample_rate?, params.n_frames)
}

/// Generate all configured LOD `.dat` files for one audio asset.
pub fn generate_all_levels(
    audio_path: &Path,
    peaks_root: &Path,
    file_id: &str,
) -> Result<PeaksGenerationReport, String> {
    generate_all_levels_inner(audio_path, peaks_root, file_id, false)
}

/// Like [`generate_all_levels`], but accepts whatever Symphonia decodes after ffmpeg remux
/// (container `n_frames` may lie on corrupt sources).
pub(crate) fn generate_all_levels_trust_decoded_length(
    audio_path: &Path,
    peaks_root: &Path,
    file_id: &str,
) -> Result<PeaksGenerationReport, String> {
    generate_all_levels_inner(audio_path, peaks_root, file_id, true)
}

fn generate_all_levels_inner(
    audio_path: &Path,
    peaks_root: &Path,
    file_id: &str,
    trust_decoded_length: bool,
) -> Result<PeaksGenerationReport, String> {
    if !audio_path.is_file() {
        return Err(format!("音频文件不存在: {}", audio_path.display()));
    }
    fs::create_dir_all(peaks_root).map_err(|e| e.to_string())?;
    let audio_fingerprint = audio_file_fingerprint(audio_path)?;

    let file = File::open(audio_path).map_err(|e| format!("打开音频失败: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = audio_path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .map_err(|e| format!("探测音频格式失败: {e}"))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "音频无可用轨道".to_string())?;
    let track_id = track.id;
    let codec_params = track.codec_params.clone();
    let sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| "无法读取采样率".to_string())?;
    let expected_frame_count = codec_params.n_frames;
    let expected_codec_duration_sec = codec_duration_sec(sample_rate, expected_frame_count);

    let mut dec = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| format!("创建解码器失败: {e}"))?;

    let dec_track = track_id;

    let mut level_writers: Vec<LevelWriter> = PEAK_LEVELS
        .iter()
        .map(|(level, pps)| LevelWriter::new(*level, *pps, sample_rate))
        .collect();

    let mut total_samples: u64 = 0;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(Error::ResetRequired) => {
                dec = symphonia::default::get_codecs()
                    .make(&codec_params, &DecoderOptions::default())
                    .map_err(|e| format!("解码器重置失败: {e}"))?;
                continue;
            }
            Err(Error::IoError(_)) => break,
            Err(e) => return Err(format!("读取音频包失败: {e}")),
        };

        if packet.track_id() != dec_track {
            continue;
        }

        match dec.decode(&packet) {
            Ok(decoded) => {
                let cap = decoded.capacity();
                if cap == 0 {
                    continue;
                }
                let spec = *decoded.spec();
                let channels = spec.channels.count().max(1);
                let mut sample_buf = SampleBuffer::<f32>::new(cap as u64, spec);
                sample_buf.copy_interleaved_ref(decoded);
                let samples = sample_buf.samples();
                for frame in samples.chunks(channels) {
                    // Arithmetic mean mixing. Out-of-phase stereo content can cancel,
                    // making the waveform look flatter than perceived loudness.
                    // Alternatives (max-abs or RMS per frame) change the visual shape;
                    // we keep mean to stay close to the "sum to mono" behaviour of
                    // most DAWs and waveform tools.
                    let mixed = if frame.is_empty() {
                        0.0
                    } else {
                        frame.iter().sum::<f32>() / channels as f32
                    };
                    for lw in &mut level_writers {
                        lw.push_sample(mixed);
                    }
                    total_samples += 1;
                }
            }
            Err(Error::IoError(_)) => break,
            Err(Error::DecodeError(_)) => continue,
            Err(e) => return Err(format!("解码失败: {e}")),
        }
    }

    for lw in &mut level_writers {
        lw.finish();
    }

    if total_samples == 0 {
        return Err("音频解码未得到任何样本".to_string());
    }

    if let Some(n_frames) = expected_frame_count {
        let expected_sec = n_frames as f64 / sample_rate as f64;
        let actual_sec = total_samples as f64 / sample_rate as f64;
        if !trust_decoded_length && !duration_covers_reference(actual_sec, expected_sec) {
            return Err(format!(
                "音频解码不完整（{} / {} 样本），已中止 peaks 写入",
                total_samples, n_frames
            ));
        }
    }

    let duration_sec = total_samples as f64 / sample_rate as f64;

    if let Some(expected_sec) = expected_codec_duration_sec {
        if !trust_decoded_length && !duration_covers_reference(duration_sec, expected_sec) {
            return Err(format!(
                "peaks 解码不完整（{duration_sec:.2}s / 容器 {expected_sec:.2}s），已中止写入"
            ));
        }
    }

    let mut generated_levels = Vec::new();

    for lw in &level_writers {
        let path = peak_file_path(peaks_root, file_id, lw.level);
        lw.write_dat(&path, sample_rate)?;
        generated_levels.push(lw.level);
    }

    let report = PeaksGenerationReport {
        sample_rate,
        duration_sec,
        generated_levels,
        audio_fingerprint: Some(audio_fingerprint),
    };
    write_peaks_meta(peaks_root, file_id, &report)?;

    Ok(report)
}

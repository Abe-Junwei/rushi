//! Stream audio through symphonia and write audiowaveform-compatible `.dat` peaks.

use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// LOD levels aligned with BBC audiowaveform `--pixels-per-second`.
pub const PEAK_LEVELS: [(u8, u32); 3] = [(0, 2), (1, 20), (2, 200)];

const DAT_VERSION: i32 = 1;
const DAT_FLAGS: i32 = 0;
const DAT_FORMAT_I16: i32 = 1;

#[derive(Debug, Clone)]
pub struct PeaksGenerationReport {
    pub sample_rate: u32,
    pub duration_sec: f64,
    pub generated_levels: Vec<u8>,
}

pub fn peaks_dir(project_dir: &Path) -> PathBuf {
    project_dir.join("peaks")
}

pub fn peak_file_path(peaks_root: &Path, file_id: &str, level: u8) -> PathBuf {
    peaks_root.join(format!("{file_id}_L{level}.dat"))
}

struct LevelWriter {
    level: u8,
    samples_per_pixel: u64,
    pixels: Vec<(i16, i16)>,
    current_pixel: u64,
    sample_in_pixel: u64,
    cur_min: f32,
    cur_max: f32,
}

impl LevelWriter {
    fn new(level: u8, pixels_per_second: u32, sample_rate: u32) -> Self {
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

    fn push_sample(&mut self, sample: f32) {
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

    fn flush_pixel(&mut self) {
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

    fn finish(&mut self) {
        if self.sample_in_pixel > 0 {
            self.flush_pixel();
        }
    }

    fn write_dat(&self, path: &Path, sample_rate: u32) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let file = File::create(path).map_err(|e| e.to_string())?;
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

/// Generate all configured LOD `.dat` files for one audio asset.
pub fn generate_all_levels(
    audio_path: &Path,
    peaks_root: &Path,
    file_id: &str,
) -> Result<PeaksGenerationReport, String> {
    if !audio_path.is_file() {
        return Err(format!("音频文件不存在: {}", audio_path.display()));
    }
    fs::create_dir_all(peaks_root).map_err(|e| e.to_string())?;

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
                    let mixed = if frame.is_empty() {
                        0.0
                    } else {
                        frame.iter().sum::<f32>() / frame.len() as f32
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

    let duration_sec = total_samples as f64 / sample_rate as f64;
    let mut generated_levels = Vec::new();

    for lw in &level_writers {
        let path = peak_file_path(peaks_root, file_id, lw.level);
        lw.write_dat(&path, sample_rate)?;
        generated_levels.push(lw.level);
    }

    Ok(PeaksGenerationReport {
        sample_rate,
        duration_sec,
        generated_levels,
    })
}

pub fn remove_peaks_for_file(peaks_root: &Path, file_id: &str) {
    for (level, _) in PEAK_LEVELS {
        let path = peak_file_path(peaks_root, file_id, level);
        let _ = fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

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
        if !fixture.is_file() {
            return;
        }
        let temp = std::env::temp_dir().join(format!("rushi-peaks-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).unwrap();
        let report = generate_all_levels(&fixture, &temp, "test-file").expect("generate peaks");
        assert!(report.duration_sec > 0.0);
        assert!(peak_file_path(&temp, "test-file", 1).is_file());
        let _ = fs::remove_dir_all(temp);
    }
}

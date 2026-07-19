use std::path::Path;
use std::time::Instant;

use serde::Serialize;
use sherpa_onnx::{SileroVadModelConfig, VadModelConfig, VoiceActivityDetector, Wave};

use crate::{
    build_qwen3_recognizer, err, resolve_qwen3_model_dir, warn_if_wav_unsuitable,
    PunctuationRestorer, Qwen3DecodeConfig, SpikeRecognizeResult, SpikeResult,
};

#[derive(Debug, Clone, Serialize)]
pub struct SpikeVadSegment {
    pub index: usize,
    pub start_sec: f64,
    pub end_sec: f64,
    pub context_start_sec: f64,
    pub context_end_sec: f64,
    pub raw_text: String,
    pub text: String,
    pub char_count: usize,
    pub token_count: usize,
    pub empty_result: bool,
    pub token_limit_reached: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct VadDecodeConfig {
    pub threshold: f32,
    pub min_silence_sec: f32,
    pub min_speech_sec: f32,
    pub max_speech_sec: f32,
    pub padding_sec: f32,
}

impl Default for VadDecodeConfig {
    fn default() -> Self {
        Self {
            threshold: 0.3,
            min_silence_sec: 0.25,
            min_speech_sec: 0.2,
            max_speech_sec: 20.0,
            padding_sec: 0.3,
        }
    }
}

impl VadDecodeConfig {
    fn validate(&self) -> SpikeResult<()> {
        if !(0.0..=1.0).contains(&self.threshold) {
            return Err(err("VAD threshold must be between 0 and 1".to_string()));
        }
        if self.min_silence_sec < 0.0 || self.min_speech_sec <= 0.0 {
            return Err(err("VAD minimum durations are invalid".to_string()));
        }
        if self.max_speech_sec < self.min_speech_sec {
            return Err(err("VAD max speech must be >= min speech".to_string()));
        }
        if self.padding_sec < 0.0 {
            return Err(err("VAD padding must not be negative".to_string()));
        }
        Ok(())
    }
}

const VAD_WINDOW_SAMPLES: usize = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct SampleRange {
    start: usize,
    end: usize,
}

fn build_vad(
    sample_rate: i32,
    vad_model: &Path,
    provider: &str,
    num_threads: i32,
    vad_config: &VadDecodeConfig,
) -> SpikeResult<VoiceActivityDetector> {
    vad_config.validate()?;
    let vad_path = vad_model
        .to_str()
        .ok_or_else(|| err(format!("vad path not utf-8: {}", vad_model.display())))?;
    if !vad_model.is_file() {
        return Err(err(format!("silero vad model not found: {vad_path}")));
    }

    let mut silero = SileroVadModelConfig::default();
    silero.model = Some(vad_path.to_string());
    silero.threshold = vad_config.threshold;
    silero.min_silence_duration = vad_config.min_silence_sec;
    silero.min_speech_duration = vad_config.min_speech_sec;
    silero.max_speech_duration = vad_config.max_speech_sec;

    let config = VadModelConfig {
        silero_vad: silero,
        ten_vad: Default::default(),
        sample_rate,
        num_threads,
        provider: Some(provider.to_string()),
        debug: false,
    };

    VoiceActivityDetector::create(&config, 60.0).ok_or_else(|| {
        err("create VoiceActivityDetector failed (check silero_vad.onnx)".to_string())
    })
}

fn collect_vad_ranges(vad: &VoiceActivityDetector, wave: &Wave) -> Vec<SampleRange> {
    let mut out = Vec::new();
    let total_samples = wave.samples().len();
    for chunk in wave.samples().chunks(VAD_WINDOW_SAMPLES) {
        vad.accept_waveform(chunk);
        while let Some(seg) = vad.front() {
            let start = (seg.start().max(0) as usize).min(total_samples);
            out.push(SampleRange {
                start,
                end: start.saturating_add(seg.samples().len()).min(total_samples),
            });
            vad.pop();
        }
    }
    vad.flush();
    while let Some(seg) = vad.front() {
        let start = (seg.start().max(0) as usize).min(total_samples);
        out.push(SampleRange {
            start,
            end: start.saturating_add(seg.samples().len()).min(total_samples),
        });
        vad.pop();
    }
    out
}

fn padded_ranges(
    ranges: &[SampleRange],
    total_samples: usize,
    padding_samples: usize,
) -> Vec<SampleRange> {
    ranges
        .iter()
        .enumerate()
        .map(|(index, range)| {
            let left_bound = if index == 0 {
                0
            } else {
                (ranges[index - 1].end + range.start) / 2
            };
            let right_bound = if index + 1 == ranges.len() {
                total_samples
            } else {
                (range.end + ranges[index + 1].start) / 2
            };
            SampleRange {
                start: range.start.saturating_sub(padding_samples).max(left_bound),
                end: range
                    .end
                    .saturating_add(padding_samples)
                    .min(right_bound)
                    .min(total_samples),
            }
        })
        .collect()
}

struct DecodedSegment {
    text: String,
    token_count: usize,
    empty_result: bool,
}

fn decode_segment(
    recognizer: &sherpa_onnx::OfflineRecognizer,
    sample_rate: i32,
    samples: &[f32],
) -> SpikeResult<DecodedSegment> {
    if samples.is_empty() {
        return Ok(DecodedSegment {
            text: String::new(),
            token_count: 0,
            empty_result: true,
        });
    }
    let stream = recognizer.create_stream();
    stream.accept_waveform(sample_rate, samples);
    recognizer.decode(&stream);
    let Some(result) = stream.get_result() else {
        return Ok(DecodedSegment {
            text: String::new(),
            token_count: 0,
            empty_result: true,
        });
    };
    Ok(DecodedSegment {
        text: result.text,
        token_count: result.tokens.len(),
        empty_result: false,
    })
}

pub fn recognize_wav_vad(
    model_dir: &Path,
    vad_model: &Path,
    wav_path: &Path,
    provider: &str,
    num_threads: i32,
    hotwords: Option<&str>,
    decode_config: &Qwen3DecodeConfig,
    vad_config: &VadDecodeConfig,
    punctuation_model: Option<&Path>,
) -> SpikeResult<SpikeRecognizeResult> {
    let resolved = resolve_qwen3_model_dir(model_dir)?;
    let wav_str = wav_path
        .to_str()
        .ok_or_else(|| err(format!("wav path not utf-8: {}", wav_path.display())))?;
    let wave = Wave::read(wav_str).ok_or_else(|| err(format!("read wav failed: {wav_str}")))?;
    let sample_rate = wave.sample_rate();
    let duration_sec = if sample_rate > 0 {
        wave.num_samples() as f64 / sample_rate as f64
    } else {
        0.0
    };
    warn_if_wav_unsuitable(sample_rate, duration_sec);

    let vad = build_vad(sample_rate, vad_model, provider, num_threads, vad_config)?;
    let recognizer =
        build_qwen3_recognizer(&resolved, provider, num_threads, hotwords, decode_config)?;
    let punctuation = punctuation_model
        .map(|model| PunctuationRestorer::create(model, provider, num_threads))
        .transpose()?;

    let started = Instant::now();
    let raw_ranges = collect_vad_ranges(&vad, &wave);
    let padding_samples = (vad_config.padding_sec * sample_rate as f32).round() as usize;
    let context_ranges = padded_ranges(&raw_ranges, wave.samples().len(), padding_samples);
    let mut segments = Vec::with_capacity(raw_ranges.len());
    let mut raw_text = String::new();
    let mut full_text = String::new();
    let mut punctuation_ms = 0u64;
    let mut token_limit_segment_count = 0usize;
    let mut empty_result_segment_count = 0usize;

    for (index, (range, context)) in raw_ranges.iter().zip(&context_ranges).enumerate() {
        let decoded = decode_segment(
            &recognizer,
            sample_rate,
            &wave.samples()[context.start..context.end],
        )?;
        let token_limit_reached = decoded.token_count >= decode_config.max_new_tokens as usize;
        token_limit_segment_count += usize::from(token_limit_reached);
        empty_result_segment_count += usize::from(decoded.empty_result);
        let text = if let Some(punct) = &punctuation {
            let punct_started = Instant::now();
            let output = punct.add(&decoded.text)?;
            punctuation_ms += punct_started.elapsed().as_millis() as u64;
            output
        } else {
            decoded.text.clone()
        };
        raw_text.push_str(&decoded.text);
        full_text.push_str(&text);
        segments.push(SpikeVadSegment {
            index,
            start_sec: range.start as f64 / sample_rate as f64,
            end_sec: range.end as f64 / sample_rate as f64,
            context_start_sec: context.start as f64 / sample_rate as f64,
            context_end_sec: context.end as f64 / sample_rate as f64,
            raw_text: decoded.text,
            char_count: text.chars().count(),
            text,
            token_count: decoded.token_count,
            empty_result: decoded.empty_result,
            token_limit_reached,
        });
    }

    let decode_ms = started.elapsed().as_millis() as u64;
    let duration_ms = duration_sec * 1000.0;
    let rtf = if duration_ms > 0.0 {
        decode_ms as f64 / duration_ms
    } else {
        0.0
    };
    let speech_samples: usize = raw_ranges
        .iter()
        .map(|r| r.end.saturating_sub(r.start))
        .sum();
    let coverage = if wave.samples().is_empty() {
        0.0
    } else {
        speech_samples as f64 / wave.samples().len() as f64
    };

    let mut pipeline_parts = vec!["vad"];
    if hotwords.is_some_and(|value| !value.trim().is_empty()) {
        pipeline_parts.push("hotwords");
    }
    if punctuation_model.is_some() {
        pipeline_parts.push("punct");
    }

    Ok(SpikeRecognizeResult {
        engine: "sherpa-onnx-vad-qwen3-asr",
        pipeline: pipeline_parts.join("-"),
        model_id: resolved.model_id,
        vad_model: Some(vad_model.display().to_string()),
        provider: provider.to_string(),
        wav_path: wav_path.display().to_string(),
        sample_rate,
        duration_sec,
        decode_ms,
        rtf,
        raw_text,
        char_count: full_text.chars().count(),
        text: full_text,
        token_count: segments.iter().map(|s| s.token_count).sum(),
        vad_segment_count: segments.len(),
        vad_audio_coverage_ratio: Some(coverage),
        empty_result_segment_count,
        token_limit_segment_count,
        max_new_tokens: decode_config.max_new_tokens,
        hotwords: hotwords.map(str::to_string),
        punctuation_model: punctuation_model.map(|p| p.display().to_string()),
        punctuation_ms,
        vad_threshold: Some(vad_config.threshold),
        vad_min_speech_sec: Some(vad_config.min_speech_sec),
        vad_min_silence_sec: Some(vad_config.min_silence_sec),
        vad_max_speech_sec: Some(vad_config.max_speech_sec),
        vad_padding_sec: Some(vad_config.padding_sec),
        segments: Some(segments),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vad_defaults_are_long_form_safe() {
        let config = VadDecodeConfig::default();
        assert!((config.threshold - 0.3).abs() < f32::EPSILON);
        assert!((config.max_speech_sec - 20.0).abs() < f32::EPSILON);
        assert!((config.padding_sec - 0.3).abs() < f32::EPSILON);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn padding_stays_in_bounds_and_does_not_overlap() {
        let ranges = vec![
            SampleRange {
                start: 100,
                end: 200,
            },
            SampleRange {
                start: 300,
                end: 400,
            },
        ];
        let padded = padded_ranges(&ranges, 500, 80);
        assert_eq!(
            padded[0],
            SampleRange {
                start: 20,
                end: 250
            }
        );
        assert_eq!(
            padded[1],
            SampleRange {
                start: 250,
                end: 480
            }
        );
    }

    #[test]
    fn padding_clamps_at_track_edges() {
        let ranges = vec![SampleRange { start: 10, end: 90 }];
        assert_eq!(
            padded_ranges(&ranges, 100, 50),
            vec![SampleRange { start: 0, end: 100 }]
        );
    }
}

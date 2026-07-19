mod p2_vad;
mod punctuation;

use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::Serialize;
use sherpa_onnx::{OfflineQwen3ASRModelConfig, OfflineRecognizer, OfflineRecognizerConfig, Wave};

pub use p2_vad::VadDecodeConfig;
pub use p2_vad::{recognize_wav_vad, SpikeVadSegment};
pub use punctuation::PunctuationRestorer;

#[derive(Debug, Clone, Serialize)]
pub struct Qwen3DecodeConfig {
    pub max_total_len: i32,
    pub max_new_tokens: i32,
}

impl Default for Qwen3DecodeConfig {
    fn default() -> Self {
        Self {
            max_total_len: 512,
            max_new_tokens: 512,
        }
    }
}

impl Qwen3DecodeConfig {
    pub fn validate(&self) -> SpikeResult<()> {
        if self.max_total_len <= 0 {
            return Err(err("max_total_len must be positive".to_string()));
        }
        if self.max_new_tokens <= 0 {
            return Err(err("max_new_tokens must be positive".to_string()));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SpikeRecognizeResult {
    pub engine: &'static str,
    pub pipeline: String,
    pub model_id: String,
    pub vad_model: Option<String>,
    pub provider: String,
    pub wav_path: String,
    pub sample_rate: i32,
    pub duration_sec: f64,
    pub decode_ms: u64,
    pub rtf: f64,
    pub raw_text: String,
    pub text: String,
    pub char_count: usize,
    pub token_count: usize,
    pub vad_segment_count: usize,
    pub vad_audio_coverage_ratio: Option<f64>,
    pub empty_result_segment_count: usize,
    pub token_limit_segment_count: usize,
    pub max_new_tokens: i32,
    pub hotwords: Option<String>,
    pub punctuation_model: Option<String>,
    pub punctuation_ms: u64,
    pub vad_threshold: Option<f32>,
    pub vad_min_speech_sec: Option<f32>,
    pub vad_min_silence_sec: Option<f32>,
    pub vad_max_speech_sec: Option<f32>,
    pub vad_padding_sec: Option<f32>,
    pub segments: Option<Vec<SpikeVadSegment>>,
}

#[derive(Debug, Clone)]
pub struct ResolvedQwen3Model {
    pub model_id: String,
    pub conv_frontend: PathBuf,
    pub encoder: PathBuf,
    pub decoder: PathBuf,
    pub tokenizer: PathBuf,
}

#[derive(Debug)]
pub struct SpikeError(pub String);

impl std::fmt::Display for SpikeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for SpikeError {}

pub type SpikeResult<T> = Result<T, SpikeError>;

pub(crate) fn err(msg: String) -> SpikeError {
    SpikeError(msg)
}

fn pick_onnx(dir: &Path, base: &str) -> Option<PathBuf> {
    for name in [format!("{base}.int8.onnx"), format!("{base}.onnx")] {
        let p = dir.join(&name);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

fn infer_model_id(model_dir: &Path) -> String {
    let dir_name = model_dir.file_name().and_then(|s| s.to_str()).unwrap_or("");
    if dir_name.contains("1.7") || dir_name.contains("1_7") {
        return "sherpa-onnx-qwen3-asr-1.7B-int8".to_string();
    }
    if dir_name.contains("0.6") || dir_name.contains("0_6") {
        return "sherpa-onnx-qwen3-asr-0.6B-int8".to_string();
    }
    "sherpa-onnx-qwen3-asr".to_string()
}

/// Resolve Qwen3-ASR ONNX pack: conv_frontend + encoder + decoder + tokenizer dir.
pub fn resolve_qwen3_model_dir(model_dir: &Path) -> SpikeResult<ResolvedQwen3Model> {
    if !model_dir.is_dir() {
        return Err(err(format!("model dir not found: {}", model_dir.display())));
    }

    let conv = model_dir.join("conv_frontend.onnx");
    if !conv.is_file() {
        return Err(err(format!(
            "missing conv_frontend.onnx in {}",
            model_dir.display()
        )));
    }

    let encoder = pick_onnx(model_dir, "encoder").ok_or_else(|| {
        err(format!(
            "missing encoder.onnx or encoder.int8.onnx in {}",
            model_dir.display()
        ))
    })?;
    let decoder = pick_onnx(model_dir, "decoder").ok_or_else(|| {
        err(format!(
            "missing decoder.onnx or decoder.int8.onnx in {}",
            model_dir.display()
        ))
    })?;

    let tokenizer =
        if model_dir.join("tokenizer.json").is_file() || model_dir.join("vocab.json").is_file() {
            model_dir.to_path_buf()
        } else {
            let tok = model_dir.join("tokenizer");
            if tok.is_dir() {
                tok
            } else {
                return Err(err(format!(
                    "missing tokenizer dir or tokenizer.json in {}",
                    model_dir.display()
                )));
            }
        };

    Ok(ResolvedQwen3Model {
        model_id: infer_model_id(model_dir),
        conv_frontend: conv,
        encoder,
        decoder,
        tokenizer,
    })
}

fn warn_if_wav_unsuitable(sample_rate: i32, duration_sec: f64) {
    if sample_rate != 16_000 {
        eprintln!(
            "warn: sample_rate={sample_rate} (Qwen3-ASR expects 16 kHz mono); resample input"
        );
    }
    if duration_sec < 0.5 {
        eprintln!("warn: duration_sec={duration_sec:.3} is very short");
    }
}

pub fn build_qwen3_recognizer(
    resolved: &ResolvedQwen3Model,
    provider: &str,
    num_threads: i32,
    hotwords: Option<&str>,
    decode_config: &Qwen3DecodeConfig,
) -> SpikeResult<OfflineRecognizer> {
    decode_config.validate()?;
    let mut config = OfflineRecognizerConfig::default();
    config.model_config.qwen3_asr = OfflineQwen3ASRModelConfig {
        conv_frontend: Some(resolved.conv_frontend.display().to_string()),
        encoder: Some(resolved.encoder.display().to_string()),
        decoder: Some(resolved.decoder.display().to_string()),
        tokenizer: Some(resolved.tokenizer.display().to_string()),
        max_total_len: decode_config.max_total_len,
        max_new_tokens: decode_config.max_new_tokens,
        temperature: 1e-6,
        top_p: 0.8,
        seed: 42,
        hotwords: hotwords.map(|s| s.to_string()),
    };
    config.model_config.num_threads = num_threads;
    config.model_config.provider = Some(provider.to_string());

    OfflineRecognizer::create(&config).ok_or_else(|| {
        err("create offline Qwen3 recognizer failed (check ONNX paths and provider)".to_string())
    })
}

pub fn recognize_wav(
    model_dir: &Path,
    wav_path: &Path,
    provider: &str,
    num_threads: i32,
    hotwords: Option<&str>,
    decode_config: &Qwen3DecodeConfig,
    punctuation_model: Option<&Path>,
) -> SpikeResult<SpikeRecognizeResult> {
    let resolved = resolve_qwen3_model_dir(model_dir)?;
    let wav_str = wav_path
        .to_str()
        .ok_or_else(|| err(format!("wav path not utf-8: {}", wav_path.display())))?;
    let wave = Wave::read(wav_str).ok_or_else(|| err(format!("read wav failed: {wav_str}")))?;
    let samples = wave.samples();
    let sample_rate = wave.sample_rate();
    let duration_sec = if sample_rate > 0 {
        samples.len() as f64 / sample_rate as f64
    } else {
        0.0
    };
    warn_if_wav_unsuitable(sample_rate, duration_sec);

    let recognizer =
        build_qwen3_recognizer(&resolved, provider, num_threads, hotwords, decode_config)?;
    let stream = recognizer.create_stream();
    stream.accept_waveform(sample_rate, samples);

    let started = Instant::now();
    recognizer.decode(&stream);
    let decode_ms = started.elapsed().as_millis() as u64;

    let result = stream
        .get_result()
        .ok_or_else(|| err("recognizer returned no result".to_string()))?;
    let duration_ms = duration_sec * 1000.0;
    let rtf = if duration_ms > 0.0 {
        decode_ms as f64 / duration_ms
    } else {
        0.0
    };
    let raw_text = result.text;
    let mut punctuation_ms = 0;
    let text = if let Some(model) = punctuation_model {
        let punct = PunctuationRestorer::create(model, provider, num_threads)?;
        let punct_started = Instant::now();
        let output = punct.add(&raw_text)?;
        punctuation_ms = punct_started.elapsed().as_millis() as u64;
        output
    } else {
        raw_text.clone()
    };
    let char_count = text.chars().count();
    let token_limit_segment_count =
        usize::from(result.tokens.len() >= decode_config.max_new_tokens as usize);

    Ok(SpikeRecognizeResult {
        engine: "sherpa-onnx-qwen3-asr",
        pipeline: "whole".to_string(),
        model_id: resolved.model_id,
        vad_model: None,
        provider: provider.to_string(),
        wav_path: wav_path.display().to_string(),
        sample_rate,
        duration_sec,
        decode_ms,
        rtf,
        raw_text,
        text,
        char_count,
        token_count: result.tokens.len(),
        vad_segment_count: 0,
        vad_audio_coverage_ratio: None,
        empty_result_segment_count: 0,
        token_limit_segment_count,
        max_new_tokens: decode_config.max_new_tokens,
        hotwords: hotwords.map(str::to_string),
        punctuation_model: punctuation_model.map(|p| p.display().to_string()),
        punctuation_ms,
        vad_threshold: None,
        vad_min_speech_sec: None,
        vad_min_silence_sec: None,
        vad_max_speech_sec: None,
        vad_padding_sec: None,
        segments: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn resolve_qwen3_requires_conv_encoder_decoder_tokenizer() {
        let dir = tempdir().unwrap();
        let model_dir = dir.path().join("sherpa-qwen3-asr-0.6B");
        fs::create_dir_all(&model_dir).unwrap();
        fs::write(model_dir.join("conv_frontend.onnx"), "x").unwrap();
        fs::write(model_dir.join("encoder.int8.onnx"), "x").unwrap();
        fs::write(model_dir.join("decoder.int8.onnx"), "x").unwrap();
        fs::write(model_dir.join("tokenizer.json"), "{}").unwrap();

        let resolved = resolve_qwen3_model_dir(&model_dir).unwrap();
        assert_eq!(resolved.model_id, "sherpa-onnx-qwen3-asr-0.6B-int8");
        assert!(resolved.encoder.ends_with("encoder.int8.onnx"));
    }

    #[test]
    fn decode_defaults_match_official_long_audio_example() {
        let config = Qwen3DecodeConfig::default();
        assert_eq!(config.max_total_len, 512);
        assert_eq!(config.max_new_tokens, 512);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn decode_config_rejects_non_positive_limits() {
        let config = Qwen3DecodeConfig {
            max_total_len: 512,
            max_new_tokens: 0,
        };
        assert!(config.validate().is_err());
    }
}

mod p2_vad;

use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::Serialize;
use sherpa_onnx::{
    OfflineQwen3ASRModelConfig, OfflineRecognizer, OfflineRecognizerConfig, Wave,
};

pub use p2_vad::{recognize_wav_vad, SpikeVadSegment};

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
    pub text: String,
    pub char_count: usize,
    pub token_count: usize,
    pub vad_segment_count: usize,
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
    let dir_name = model_dir
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
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

    let tokenizer = if model_dir.join("tokenizer.json").is_file()
        || model_dir.join("vocab.json").is_file()
    {
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
) -> SpikeResult<OfflineRecognizer> {
    let mut config = OfflineRecognizerConfig::default();
    config.model_config.qwen3_asr = OfflineQwen3ASRModelConfig {
        conv_frontend: Some(resolved.conv_frontend.display().to_string()),
        encoder: Some(resolved.encoder.display().to_string()),
        decoder: Some(resolved.decoder.display().to_string()),
        tokenizer: Some(resolved.tokenizer.display().to_string()),
        max_total_len: 512,
        max_new_tokens: 128,
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

    let recognizer = build_qwen3_recognizer(&resolved, provider, num_threads, hotwords)?;
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
    let char_count = result.text.chars().count();

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
        text: result.text,
        char_count,
        token_count: result.tokens.len(),
        vad_segment_count: 0,
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
}

mod p2_vad;

use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::Serialize;
use sherpa_onnx::{
    OfflineParaformerModelConfig, OfflineRecognizer, OfflineRecognizerConfig, Wave,
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
    /// decode_ms / (duration_sec * 1000); <1 means faster than realtime.
    pub rtf: f64,
    pub text: String,
    pub char_count: usize,
    pub token_count: usize,
    pub timestamp_count: usize,
    /// Heuristic sentence breaks from token timestamp gaps (P0 only).
    pub pseudo_segment_count: usize,
    /// VAD segment count (P2); 0 for P0 whole-track.
    pub vad_segment_count: usize,
    pub timestamps_sec: Option<Vec<f32>>,
    /// Per-VAD-segment decode (P2 only).
    pub segments: Option<Vec<SpikeVadSegment>>,
}

#[derive(Debug)]
pub struct ResolvedModel {
    pub model_id: String,
    pub model_onnx: PathBuf,
    pub tokens: PathBuf,
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

fn infer_model_id(model_dir: &Path, onnx_file: &str) -> String {
    let dir_name = model_dir
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    if dir_name.contains("2023-09-14") {
        return "sherpa-onnx-paraformer-zh-2023-09-14".to_string();
    }
    if dir_name.contains("2024-03-09") {
        return "sherpa-onnx-paraformer-zh-2024-03-09".to_string();
    }
    if dir_name.contains("int8") && dir_name.contains("2025") {
        return "sherpa-onnx-paraformer-zh-int8-2025-10-07".to_string();
    }

    match onnx_file {
        "model.int8.onnx" => "sherpa-onnx-paraformer-zh-int8".to_string(),
        _ => "sherpa-onnx-paraformer-zh".to_string(),
    }
}

/// Resolve `model.onnx` / `model.int8.onnx` + `tokens.txt` under `model_dir`.
pub fn resolve_model_dir(model_dir: &Path) -> SpikeResult<ResolvedModel> {
    if !model_dir.is_dir() {
        return Err(err(format!("model dir not found: {}", model_dir.display())));
    }

    let tokens = model_dir.join("tokens.txt");
    if !tokens.is_file() {
        return Err(err(format!("missing tokens.txt in {}", model_dir.display())));
    }

    for file in ["model.int8.onnx", "model.onnx"] {
        let onnx = model_dir.join(file);
        if onnx.is_file() {
            return Ok(ResolvedModel {
                model_id: infer_model_id(model_dir, file),
                model_onnx: onnx,
                tokens,
            });
        }
    }

    Err(err(format!(
        "missing model.onnx or model.int8.onnx in {}",
        model_dir.display()
    )))
}

/// Gap between consecutive token timestamps above this ⇒ new pseudo-segment.
const PSEUDO_SEGMENT_GAP_SEC: f32 = 1.2;

pub fn pseudo_segment_count(timestamps: Option<&[f32]>) -> usize {
    let Some(ts) = timestamps else {
        return 0;
    };
    if ts.is_empty() {
        return 0;
    }
    if ts.len() == 1 {
        return 1;
    }
    let mut count = 1usize;
    for w in ts.windows(2) {
        if w[1] - w[0] > PSEUDO_SEGMENT_GAP_SEC {
            count += 1;
        }
    }
    count
}

fn warn_if_wav_unsuitable(sample_rate: i32, duration_sec: f64) {
    if sample_rate != 16_000 {
        eprintln!(
            "warn: sample_rate={sample_rate} (Paraformer expects 16 kHz mono); resample or use bundled test_wavs"
        );
    }
    if duration_sec < 0.5 {
        eprintln!(
            "warn: duration_sec={duration_sec:.3} is very short; empty transcript is likely"
        );
    }
}

pub fn recognize_wav(
    model_dir: &Path,
    wav_path: &Path,
    provider: &str,
    num_threads: i32,
) -> SpikeResult<SpikeRecognizeResult> {
    let resolved = resolve_model_dir(model_dir)?;
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

    let mut config = OfflineRecognizerConfig::default();
    config.model_config.paraformer = OfflineParaformerModelConfig {
        model: Some(resolved.model_onnx.display().to_string()),
    };
    config.model_config.tokens = Some(resolved.tokens.display().to_string());
    config.model_config.num_threads = num_threads;
    config.model_config.provider = Some(provider.to_string());
    config.decoding_method = Some("greedy_search".into());

    let recognizer = OfflineRecognizer::create(&config)
        .ok_or_else(|| {
            err("create offline recognizer failed (check model paths and provider)".to_string())
        })?;
    let stream = recognizer.create_stream();
    stream.accept_waveform(sample_rate, samples);

    let started = Instant::now();
    recognizer.decode(&stream);
    let decode_ms = started.elapsed().as_millis() as u64;

    let result = stream
        .get_result()
        .ok_or_else(|| err("recognizer returned no result".to_string()))?;
    let timestamp_count = result.timestamps.as_ref().map(|t| t.len()).unwrap_or(0);
    let pseudo_segments = pseudo_segment_count(result.timestamps.as_deref());
    let duration_ms = duration_sec * 1000.0;
    let rtf = if duration_ms > 0.0 {
        decode_ms as f64 / duration_ms
    } else {
        0.0
    };

    let char_count = result.text.chars().count();

    Ok(SpikeRecognizeResult {
        engine: "sherpa-onnx-paraformer",
        pipeline: "p0".to_string(),
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
        timestamp_count,
        pseudo_segment_count: pseudo_segments,
        vad_segment_count: 0,
        timestamps_sec: result.timestamps,
        segments: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn resolve_model_dir_requires_tokens_and_onnx() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("tokens.txt"), "a\n").unwrap();
        fs::write(dir.path().join("model.onnx"), "x").unwrap();

        let resolved = resolve_model_dir(dir.path()).unwrap();
        assert_eq!(resolved.model_id, "sherpa-onnx-paraformer-zh");
        assert!(resolved.model_onnx.ends_with("model.onnx"));
    }

    #[test]
    fn resolve_model_dir_prefers_int8_when_present() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("tokens.txt"), "a\n").unwrap();
        fs::write(dir.path().join("model.onnx"), "x").unwrap();
        fs::write(dir.path().join("model.int8.onnx"), "y").unwrap();

        let resolved = resolve_model_dir(dir.path()).unwrap();
        assert_eq!(resolved.model_id, "sherpa-onnx-paraformer-zh-int8");
    }

    #[test]
    fn pseudo_segment_count_splits_on_timestamp_gaps() {
        let ts = vec![0.0_f32, 0.5, 1.0, 3.0, 3.5];
        assert_eq!(pseudo_segment_count(Some(&ts)), 2);
    }

    #[test]
    fn resolve_model_id_from_p0_directory_name() {
        let dir = tempdir().unwrap();
        let model_dir = dir.path().join("sherpa-paraformer-zh-2023-09-14");
        fs::create_dir_all(&model_dir).unwrap();
        fs::write(model_dir.join("tokens.txt"), "a\n").unwrap();
        fs::write(model_dir.join("model.int8.onnx"), "y").unwrap();

        let resolved = resolve_model_dir(&model_dir).unwrap();
        assert_eq!(
            resolved.model_id,
            "sherpa-onnx-paraformer-zh-2023-09-14"
        );
    }
}

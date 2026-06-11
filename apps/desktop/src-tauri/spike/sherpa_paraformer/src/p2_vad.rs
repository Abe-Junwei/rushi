use std::path::Path;
use std::time::Instant;

use sherpa_onnx::{
    OfflineParaformerModelConfig, OfflineRecognizer, OfflineRecognizerConfig, SileroVadModelConfig,
    VadModelConfig, VoiceActivityDetector, Wave,
};

use crate::{
    err, resolve_model_dir, warn_if_wav_unsuitable, SpikeRecognizeResult, SpikeResult,
};

#[derive(Debug, Clone, serde::Serialize)]
pub struct SpikeVadSegment {
    pub index: usize,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
    pub char_count: usize,
}

/// FunASR sidecar default `RUSHI_FUNASR_VAD_MAX_MS` = 30000.
const MAX_SPEECH_DURATION_SEC: f32 = 30.0;
const VAD_WINDOW_SAMPLES: usize = 512;

fn build_vad(sample_rate: i32, vad_model: &Path, provider: &str, num_threads: i32) -> SpikeResult<VoiceActivityDetector> {
    let vad_path = vad_model
        .to_str()
        .ok_or_else(|| err(format!("vad path not utf-8: {}", vad_model.display())))?;
    if !vad_model.is_file() {
        return Err(err(format!("silero vad model not found: {vad_path}")));
    }

    let mut silero = SileroVadModelConfig::default();
    silero.model = Some(vad_path.to_string());
    silero.threshold = 0.5;
    silero.min_silence_duration = 0.25;
    silero.min_speech_duration = 0.25;
    silero.max_speech_duration = MAX_SPEECH_DURATION_SEC;

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

fn build_recognizer(
    resolved: &crate::ResolvedModel,
    provider: &str,
    num_threads: i32,
) -> SpikeResult<OfflineRecognizer> {
    let mut config = OfflineRecognizerConfig::default();
    config.model_config.paraformer = OfflineParaformerModelConfig {
        model: Some(resolved.model_onnx.display().to_string()),
    };
    config.model_config.tokens = Some(resolved.tokens.display().to_string());
    config.model_config.num_threads = num_threads;
    config.model_config.provider = Some(provider.to_string());
    config.decoding_method = Some("greedy_search".into());

    OfflineRecognizer::create(&config).ok_or_else(|| {
        err("create offline recognizer failed (check paraformer model paths)".to_string())
    })
}

fn decode_segment(
    recognizer: &OfflineRecognizer,
    sample_rate: i32,
    samples: &[f32],
) -> SpikeResult<String> {
    let stream = recognizer.create_stream();
    stream.accept_waveform(sample_rate, samples);
    recognizer.decode(&stream);
    let result = stream
        .get_result()
        .ok_or_else(|| err("vad segment decode returned no result".to_string()))?;
    Ok(result.text)
}

fn collect_vad_segments(
    vad: &VoiceActivityDetector,
    wave: &Wave,
) -> Vec<(i32, Vec<f32>)> {
    let sample_rate = wave.sample_rate();
    let mut out = Vec::new();

    for chunk in wave.samples().chunks(VAD_WINDOW_SAMPLES) {
        vad.accept_waveform(chunk);
        while let Some(seg) = vad.front() {
            out.push((seg.start(), seg.samples().to_vec()));
            vad.pop();
        }
    }
    vad.flush();
    while let Some(seg) = vad.front() {
        out.push((seg.start(), seg.samples().to_vec()));
        vad.pop();
    }

    let _ = sample_rate;
    out
}

/// P2: Silero VAD → per-segment offline Paraformer (paraformer-large ONNX).
pub fn recognize_wav_vad(
    model_dir: &Path,
    vad_model: &Path,
    wav_path: &Path,
    provider: &str,
    num_threads: i32,
) -> SpikeResult<SpikeRecognizeResult> {
    let resolved = resolve_model_dir(model_dir)?;
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

    let vad = build_vad(sample_rate, vad_model, provider, num_threads)?;
    let recognizer = build_recognizer(&resolved, provider, num_threads)?;

    let started = Instant::now();
    let raw_segments = collect_vad_segments(&vad, &wave);
    let mut segments = Vec::with_capacity(raw_segments.len());
    let mut full_text = String::new();

    for (index, (start_sample, samples)) in raw_segments.into_iter().enumerate() {
        let text = decode_segment(&recognizer, sample_rate, &samples)?;
        let char_count = text.chars().count();
        let start_sec = start_sample as f64 / sample_rate as f64;
        let end_sec = start_sec + samples.len() as f64 / sample_rate as f64;
        full_text.push_str(&text);
        segments.push(SpikeVadSegment {
            index,
            start_sec,
            end_sec,
            text,
            char_count,
        });
    }

    let decode_ms = started.elapsed().as_millis() as u64;
    let duration_ms = duration_sec * 1000.0;
    let rtf = if duration_ms > 0.0 {
        decode_ms as f64 / duration_ms
    } else {
        0.0
    };
    let char_count = full_text.chars().count();

    Ok(SpikeRecognizeResult {
        engine: "sherpa-onnx-vad-paraformer",
        pipeline: "p2".to_string(),
        model_id: resolved.model_id,
        vad_model: Some(vad_model.display().to_string()),
        provider: provider.to_string(),
        wav_path: wav_path.display().to_string(),
        sample_rate,
        duration_sec,
        decode_ms,
        rtf,
        text: full_text,
        char_count,
        token_count: 0,
        timestamp_count: 0,
        pseudo_segment_count: 0,
        vad_segment_count: segments.len(),
        timestamps_sec: None,
        segments: Some(segments),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn max_speech_duration_matches_funasr_default() {
        assert!((MAX_SPEECH_DURATION_SEC - 30.0).abs() < f32::EPSILON);
    }
}

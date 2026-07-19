use std::fs;
use std::path::PathBuf;

use clap::{Parser, ValueEnum};
use rushi_spike_sherpa_qwen3::{
    recognize_wav, recognize_wav_vad, Qwen3DecodeConfig, VadDecodeConfig,
};

#[derive(Clone, Debug, ValueEnum)]
enum Pipeline {
    /// Whole-track offline Qwen3-ASR.
    Whole,
    /// Silero VAD + per-segment Qwen3-ASR.
    Vad,
}

#[derive(Parser, Debug)]
#[command(
    name = "spike_sherpa_qwen3",
    about = "R3g-B Sherpa-ONNX Qwen3-ASR spike (non-product path)"
)]
struct Args {
    #[arg(long)]
    wav: PathBuf,

    #[arg(long, env = "SHERPA_QWEN3_MODEL_DIR")]
    model_dir: PathBuf,

    #[arg(long, env = "SHERPA_SILERO_VAD_MODEL")]
    vad_model: Option<PathBuf>,

    #[arg(
        long,
        value_enum,
        default_value = "whole",
        env = "SHERPA_QWEN3_PIPELINE"
    )]
    pipeline: Pipeline,

    #[arg(long, default_value = "cpu")]
    provider: String,

    #[arg(long, default_value_t = 4)]
    threads: i32,

    #[arg(long)]
    hotwords: Option<String>,

    #[arg(long, env = "SHERPA_PUNCTUATION_MODEL")]
    punct_model: Option<PathBuf>,

    #[arg(long, default_value_t = 512)]
    max_total_len: i32,

    #[arg(long, default_value_t = 512)]
    max_new_tokens: i32,

    #[arg(long, default_value_t = 0.3)]
    vad_threshold: f32,

    #[arg(long, default_value_t = 0.25)]
    vad_min_silence_sec: f32,

    #[arg(long, default_value_t = 0.2)]
    vad_min_speech_sec: f32,

    #[arg(long, default_value_t = 20.0)]
    vad_max_speech_sec: f32,

    #[arg(long, default_value_t = 0.3)]
    vad_padding_sec: f32,

    #[arg(long)]
    output: Option<PathBuf>,
}

fn main() {
    if let Err(e) = run() {
        eprintln!("spike_sherpa_qwen3 error: {e}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = Args::parse();
    if !args.wav.is_file() {
        return Err(format!("wav not found: {}", args.wav.display()));
    }

    let hotwords = args.hotwords.as_deref();
    let decode_config = Qwen3DecodeConfig {
        max_total_len: args.max_total_len,
        max_new_tokens: args.max_new_tokens,
    };
    let vad_config = VadDecodeConfig {
        threshold: args.vad_threshold,
        min_silence_sec: args.vad_min_silence_sec,
        min_speech_sec: args.vad_min_speech_sec,
        max_speech_sec: args.vad_max_speech_sec,
        padding_sec: args.vad_padding_sec,
    };
    let punctuation_model = args.punct_model.as_deref();
    let result = match args.pipeline {
        Pipeline::Whole => recognize_wav(
            &args.model_dir,
            &args.wav,
            &args.provider,
            args.threads,
            hotwords,
            &decode_config,
            punctuation_model,
        )
        .map_err(|e| e.to_string())?,
        Pipeline::Vad => {
            let vad = args.vad_model.ok_or_else(|| {
                "VAD pipeline requires --vad-model or SHERPA_SILERO_VAD_MODEL".to_string()
            })?;
            recognize_wav_vad(
                &args.model_dir,
                &vad,
                &args.wav,
                &args.provider,
                args.threads,
                hotwords,
                &decode_config,
                &vad_config,
                punctuation_model,
            )
            .map_err(|e| e.to_string())?
        }
    };

    let json = serde_json::to_string_pretty(&result).map_err(|e| e.to_string())?;
    if let Some(path) = args.output {
        fs::write(&path, &json).map_err(|e| format!("write {}: {e}", path.display()))?;
        eprintln!("wrote {}", path.display());
    } else {
        println!("{json}");
    }
    Ok(())
}

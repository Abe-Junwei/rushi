use std::fs;
use std::path::PathBuf;

use clap::{Parser, ValueEnum};
use rushi_spike_sherpa_paraformer::{recognize_wav, recognize_wav_vad};

#[derive(Clone, Debug, ValueEnum)]
enum Pipeline {
    /// Whole-track offline Paraformer (P0).
    P0,
    /// Silero VAD + per-segment Paraformer-large (P2).
    P2,
}

#[derive(Parser, Debug)]
#[command(
    name = "spike_sherpa_paraformer",
    about = "R3h-3.5 Sherpa-ONNX Paraformer offline spike (non-product path)"
)]
struct Args {
    /// Input WAV (16-bit PCM; sherpa-onnx Wave reader).
    #[arg(long)]
    wav: PathBuf,

    /// Directory containing tokens.txt and model.onnx / model.int8.onnx.
    #[arg(long, env = "SHERPA_PARAFORMER_MODEL_DIR")]
    model_dir: PathBuf,

    /// Silero VAD ONNX (required for --pipeline p2).
    #[arg(long, env = "SHERPA_SILERO_VAD_MODEL")]
    vad_model: Option<PathBuf>,

    #[arg(long, value_enum, default_value = "p0", env = "SHERPA_PIPELINE")]
    pipeline: Pipeline,

    /// onnxruntime provider: cpu, coreml, cuda, directml, …
    #[arg(long, default_value = "cpu")]
    provider: String,

    #[arg(long, default_value_t = 2)]
    threads: i32,

    /// Write JSON result to file (stdout if omitted).
    #[arg(long)]
    output: Option<PathBuf>,
}

fn main() {
    if let Err(e) = run() {
        eprintln!("spike_sherpa_paraformer error: {e}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = Args::parse();
    if !args.wav.is_file() {
        return Err(format!("wav not found: {}", args.wav.display()));
    }

    let result = match args.pipeline {
        Pipeline::P0 => recognize_wav(&args.model_dir, &args.wav, &args.provider, args.threads)
            .map_err(|e| e.to_string())?,
        Pipeline::P2 => {
            let vad = args.vad_model.ok_or_else(|| {
                "P2 requires --vad-model or SHERPA_SILERO_VAD_MODEL (silero_vad.onnx)".to_string()
            })?;
            recognize_wav_vad(
                &args.model_dir,
                &vad,
                &args.wav,
                &args.provider,
                args.threads,
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

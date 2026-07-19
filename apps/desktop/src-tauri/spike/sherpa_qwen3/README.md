# Sherpa-ONNX Chinese A pipeline spike

Non-product harness for `Silero VAD -> Qwen3-ASR-0.6B INT8 -> CT-Transformer punctuation`, plus the older Sherpa/FunASR comparison.

## Prerequisites

Download the three official k2-fsa assets used by pipeline A:

```bash
bash scripts/r3s-a-download-sherpa-models.sh
```

For the older side-by-side comparison, also cache the FunASR `Qwen/Qwen3-ASR-0.6B` weights.

## Gold-set evaluation

```bash
python3 scripts/eval-sherpa-run.py
python3 scripts/eval-sherpa-run.py --hotwords-mode off --punctuation-mode off
```

The evaluator requires A's Qwen3 + VAD assets, uses the manifest gold transcript, reports both content CER and punctuation CER, and writes JSON plus `.raw.txt` / `.punctuated.txt` outputs under `docs/execution/spike-output/`. Use `--hotwords-mode off` for a clean model baseline and `--punctuation-mode off` to keep Qwen3 raw punctuation without the external CT-Transformer punctuation pass.

## Compare

```bash
# 30s smoke — whole-track Sherpa vs FunASR direct engine
bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --duration 30

# Long clip with Silero VAD + per-segment Qwen3 (closer to FunASR VAD windows)
bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --duration 780 --pipeline vad

# Optional: enable FunASR timestamps (ForcedAligner spike)
export RUSHI_FUNASR_FORCED_ALIGNER=Qwen/Qwen3-ForcedAligner-0.6B
bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --duration 30
```

Outputs: `docs/execution/spike-output/qwen3-0.6b-YYYY-MM-DD/`.

## CLI only

```bash
export SHERPA_QWEN3_MODEL_DIR=fixtures/sherpa-qwen3-asr-0.6B-int8-2026-03-25
export SHERPA_SILERO_VAD_MODEL=fixtures/sherpa-vad/silero_vad.onnx
export SHERPA_PUNCTUATION_MODEL=fixtures/sherpa-punctuation-zh-en/model.int8.onnx
cargo run --manifest-path apps/desktop/src-tauri/spike/sherpa_qwen3/Cargo.toml -- \
  --wav /path/to/16k.wav --pipeline vad --hotwords "如是,专有名词" --output /tmp/out.json
```

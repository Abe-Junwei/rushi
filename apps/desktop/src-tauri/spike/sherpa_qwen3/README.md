# Sherpa-ONNX Qwen3-ASR spike (R3g-B)

Non-product harness to compare **Sherpa ONNX** vs **FunASR PyTorch** on the same SKU family (`Qwen3-ASR-0.6B`).

## Prerequisites

1. FunASR weights cached: `Qwen/Qwen3-ASR-0.6B` (ModelScope / Rushi models root).
2. Sherpa ONNX pack (separate from PyTorch weights):

```bash
bash scripts/r3g-b-download-sherpa-qwen3-onnx.sh
```

3. Optional VAD for long-audio fair compare:

```bash
bash scripts/r3h-3.5-download-sherpa-p2.sh   # silero_vad.onnx only if paraformer tar fails
```

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
export SHERPA_QWEN3_MODEL_DIR=fixtures/sherpa-qwen3-asr-0.6B
cargo run --manifest-path apps/desktop/src-tauri/spike/sherpa_qwen3/Cargo.toml -- \
  --wav /path/to/16k.wav --pipeline whole --output /tmp/out.json
```

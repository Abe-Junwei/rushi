# R3h-3.5 — Sherpa-ONNX Paraformer spike harness

> **非产品路径**。Spike 结论前不得接入 `run_transcribe_cmd` 或环境页引擎切换。  
> **Spec**：[`docs/execution/specs/r3h-3.5-sherpa-spike-acceptance.md`](../../../../docs/execution/specs/r3h-3.5-sherpa-spike-acceptance.md)

## 对比基线

- FunASR hub：`iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch`
- 侧车：`http://127.0.0.1:8741`

## Sherpa 模型（P0 推荐）

| ID | 包 | 说明 |
|----|-----|------|
| P0 | `sherpa-onnx-paraformer-zh-2023-09-14` | 支持 **timestamps** |
| P1 | `sherpa-onnx-paraformer-zh-int8-2025-10-07` | 轻量 INT8 |
| **P2** | `silero_vad.onnx` + `sherpa-onnx-paraformer-zh-2024-03-09` | **VAD + Paraformer-large**（逼近 FunASR vad 切段；**仍无 punc**） |

下载（示例 P0）：

```bash
curl -L -o /tmp/sherpa-paraformer.tar.bz2 \
  https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2
mkdir -p ~/models/sherpa-paraformer-zh-2023-09-14
tar -xjf /tmp/sherpa-paraformer.tar.bz2 -C ~/models/sherpa-paraformer-zh-2023-09-14 --strip-components=1
export SHERPA_PARAFORMER_MODEL_DIR=~/models/sherpa-paraformer-zh-2023-09-14
```

目录内需含 `tokens.txt` 与 `model.onnx`（或 `model.int8.onnx`）。

## 构建与单测

```bash
cargo test --manifest-path apps/desktop/src-tauri/spike/sherpa_paraformer/Cargo.toml
```

首次构建会下载 `sherpa-onnx` 静态库（按平台自动选择）。

## 跑一条样本

输入须 **16 kHz mono PCM**（Paraformer 训练采样率）。`fixtures/eval/samples/*.wav` 为 44.1 kHz / ~0.15 s 占位，**不适合** Sherpa spike；优先用模型包内 `test_wavs/0.wav`。

```bash
export SHERPA_PARAFORMER_MODEL_DIR=~/models/sherpa-paraformer-zh-2023-09-14
bash scripts/r3h-3.5-run-sherpa-spike.sh
# 显式路径：bash scripts/r3h-3.5-run-sherpa-spike.sh "$SHERPA_PARAFORMER_MODEL_DIR/test_wavs/0.wav"

# macOS CoreML smoke（若 ORT 回退 cpu，见 stderr）
SHERPA_PROVIDER=coreml bash scripts/r3h-3.5-run-sherpa-spike.sh
```

输出 JSON 写入 `docs/execution/spike-output/sherpa-paraformer-YYYY-MM-DD/`（已 gitignore）。

## 长音频对比（13min）

```bash
export SHERPA_PARAFORMER_MODEL_DIR=~/models/sherpa-paraformer-zh-2023-09-14
bash scripts/r3h-3.5-sherpa-long-compare.sh              # 780s clip from fixtures/eval/samples/制控.mp3
bash scripts/r3h-3.5-sherpa-long-compare.sh --duration 30  # 快速 smoke
# FunASR 基线（侧车在线时自动 curl）：
# npm run asr:dev & 然后重跑上一命令
```

P1 INT8：`bash scripts/r3h-3.5-download-sherpa-p1.sh`

### P2（Silero VAD + 逐段 Paraformer）

```bash
bash scripts/r3h-3.5-download-sherpa-p2.sh   # silero_vad + paraformer-large (~1GB tar)
export SHERPA_SILERO_VAD_MODEL=fixtures/sherpa-vad/silero_vad.onnx
export SHERPA_PARAFORMER_MODEL_DIR=fixtures/sherpa-paraformer-zh-2024-03-09
export SHERPA_PIPELINE=p2
bash scripts/r3h-3.5-sherpa-long-compare.sh --duration 30
bash scripts/r3h-3.5-sherpa-long-compare.sh   # 780s + FunASR 定量（侧车在线时）
```

`max_speech_duration=30s` 对齐 FunASR `RUSHI_FUNASR_VAD_MAX_MS`。JSON 含 `segments[]`（VAD 起止 + 段文本）。

定量对比（FunASR 作参考 CER）：

```bash
export RUSHI_FUNASR_MODEL=iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch
npm run asr:dev   # 另终端
export SHERPA_PARAFORMER_MODEL_DIR=...
bash scripts/r3h-3.5-sherpa-long-compare.sh --duration 30
bash scripts/r3h-3.5-sherpa-long-compare.sh   # 780s
# → quant-compare-{30,780}s.json
```

**Spike 结论**：[ADR-0006](../../../../docs/adr/0006-sherpa-onnx-paraformer-spike-evaluation.md) — **Partial Go**。

## CLI

```bash
cargo run --manifest-path apps/desktop/src-tauri/spike/sherpa_paraformer/Cargo.toml -- \
  --wav path/to/mono16k.wav \
  --model-dir "$SHERPA_PARAFORMER_MODEL_DIR" \
  --provider cpu
```

## 不测

- SenseVoice（catalog 已弃用）
- Qwen3-ASR（Q-ASR-1 No-go）

## 编码落位

| 文件 | 职责 |
|------|------|
| `src/lib.rs` | P0 `recognize_wav` |
| `src/p2_vad.rs` | P2 `recognize_wav_vad` |
| `src/main.rs` | CLI `--pipeline p0\|p2` → JSON |
| `scripts/r3h-3.5-run-sherpa-spike.sh` | 手测一键跑 |

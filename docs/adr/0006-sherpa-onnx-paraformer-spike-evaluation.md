---
adr: "0006"
title: Sherpa-ONNX Paraformer Spike 评估 — Partial Go（轻量候选，非长音频主路径替代）
status: accepted
date: 2026-06-11
supersedes: null
related: ["0003"]
---

# ADR-0006：Sherpa-ONNX Paraformer Spike 评估

## 上下文

[R3h-3.5](../execution/specs/r3h-3.5-sherpa-spike-acceptance.md) 在 **不接产品转写路径** 前提下，用 Rust harness 对比：

- **Sherpa P0**：`sherpa-onnx-paraformer-zh-2023-09-14`（~240MB `model.int8.onnx`）
- **基线**：FunASR `speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch` 侧车

catalog 真源仅主推 **Paraformer 长音频**；SenseVoice / Qwen3 不作 Go 门控（见 [ADR-0003](./0003-asr-engine-funasr-first-sherpa-spike-gate.md) 附录 A）。

## Spike 证据（2026-06-11）

Harness：`apps/desktop/src-tauri/spike/sherpa_paraformer/`；脚本：`scripts/r3h-3.5-run-sherpa-spike.sh`、`scripts/r3h-3.5-sherpa-long-compare.sh`。

| 样本 | 时长 | Sherpa RTF | FunASR RTF | 语段 | CER† (S\|F) | 备注 |
|------|------|------------|------------|------|-------------|------|
| `test_wavs/0.wav` | 5.6s | ~0.05 | — | — | — | 正常短句；timestamps 29 |
| `制控.mp3` clip | 30s | **0.049** | **0.261** | 7 / **10** | **0.224** | `quant-compare-30s.json` |
| `制控.mp3` clip | **780s** | **0.184** | **0.089** | 125 / **117** | **0.670** | `quant-compare-780s.json` |

† **CER** = 字级编辑距离 / FunASR 假设长度（**无金标**；FunASR Paraformer+vad+punc 作参考）。对称 CER（F\|S）30s=0.241，780s=0.749。

**定量结论（2026-06-11，`npm run asr:dev` + Paraformer SKU）**：

- **精度**：13min 交叉 CER **~67%**，远高于可产品化阈值；30s 亦 **~22%**（无标点、无 VAD 的 Sherpa 裸 ASR 与 FunASR 管线不等价）。
- **速度**：本机 CPU 上 FunASR 13min **RTF≈0.09** 快于 Sherpa **0.18**（Sherpa 体积优势仍在，但非 RTF 全面胜出）。
- **语段数**：13min FunASR **117** 句级段 vs Sherpa **125** 伪段 — 数量接近，**不能**弥补文本偏差。
- **专名**：clip 前 30s / 13min 内 `制控` term_hit **均为 0**（专名出现在更后时段；hotwords 仅作用于 FunASR）。

产物：`docs/execution/spike-output/sherpa-paraformer-2026-06-11/quant-compare-{30,780}s.json`（gitignore）。  
**产品对照验收**（可提交）：[`r3h-3.5-sherpa-quant-compare-report.md`](../execution/specs/r3h-3.5-sherpa-quant-compare-report.md)

**能力差距（Spike 期）**

| 能力 | FunASR 基线 | Sherpa P0 harness |
|------|-------------|-------------------|
| VAD 多语段 | ✅ `segmentation.py` | ❌ 仅 token 时间戳；`pseudo_segment_count` 为启发式 |
| 标点 | ✅ ct-punc | ❌ |
| hotwords | ✅ multipart | ❌ 未验证 |
| 长音频 13min+ | ✅ R3t 签收 | ⚠️ 能跑完但质量未达标 |
| 体积 | ~2.5GB 侧车 | ~240MB 单模型权重 |
| macOS CoreML | N/A | ⚠️ smoke 时 ORT **回退 cpu** |

**P1 INT8**（`paraformer-zh-int8-2025-10-07`）：未在本轮下载完成；见 `scripts/r3h-3.5-download-sherpa-p1.sh`。

## 决策

**Partial Go**（对齐 [ADR-0003](./0003-asr-engine-funasr-first-sherpa-spike-gate.md) 附录 A 分支 2）。

1. **v1 默认引擎不变**：继续 **FunASR 侧车 + Paraformer 长音频** SKU；**不删除** `services/asr` 主路径。
2. **Sherpa 定位**：轻量 / 中期 **候选**，仅在补齐 **VAD + 标点**（如 Sherpa 官方 VAD+Paraformer 预训练包，research P2）且 FunASR A/B CER 达标后，才进入 `asr_engine` 双轨产品薄片。
3. **本 Spike harness 保留**：供后续 P1/P2、CoreML、Win GPU 对比；**禁止**在未修订 ADR 前接入 `run_transcribe_cmd`。
4. **hotwords**：列为 **No**（当前 Paraformer ONNX 路径无等价 multipart hotwords）；迁移前须单独 spike 或接受缺失。
5. **No-go 项**：以 Sherpa P0 **单独**替换 FunASR 长音频主路径；SenseVoice / Qwen3 作为 Go 依据。

## 后果

### 正面

- 证实 Sherpa Paraformer **RTF 与体积**优于侧车，值得保留为 R&D 轨。
- token 级 timestamps 可用，为 R3g-B 类对齐实验提供备选信号源（质量待验）。

### 负面

- 13min 质量未达产品栏；需 **VAD+punc 管线** 或更强 SKU，不能只换 ONNX 权重。
- CoreML / P1 / FunASR CER 定量对比仍待补（侧车在线时重跑 `r3h-3.5-sherpa-long-compare.sh`）。

## 验证 / 后续

| 项 | 命令 / 产物 |
|----|-------------|
| 复现 P0 13min | `SHERPA_PARAFORMER_MODEL_DIR=... bash scripts/r3h-3.5-sherpa-long-compare.sh` |
| FunASR 对比 | `npm run asr:dev` 后同上（去掉 `--skip-funasr`） |
| P1 下载 | `bash scripts/r3h-3.5-download-sherpa-p1.sh` |
| 产物 | `docs/execution/spike-output/sherpa-paraformer-*/`（gitignore） |

**下一薄片（若推进双轨）**：ADR-0003 附录 B — `asr_engine` 配置、HTTP 薄兼容层、环境页「轻量引擎」文案；**默认仍 FunASR**。

## 参考

- [`r3h-3.5-sherpa-spike-research.md`](../execution/specs/r3h-3.5-sherpa-spike-research.md)
- [`r3h-3.5-sherpa-spike-acceptance.md`](../execution/specs/r3h-3.5-sherpa-spike-acceptance.md)
- [Sherpa Paraformer 模型表](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-paraformer/paraformer-models.html)

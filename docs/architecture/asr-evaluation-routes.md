# ASR 路线测评汇总

> **Agent 先读结论**：Rushi 当前本机中文长课音频默认路线仍是 **FunASR 侧车 + Paraformer 长音频 SKU**。SenseVoice、Fun-ASR-Nano、Qwen3 FunASR、Qwen3 + ForcedAligner、Sherpa Paraformer、Sherpa Qwen3 均已有 spike 证据；未满足对应门槛前不要重新提为默认链路。

## 当前决策

| 路线 | 当前状态 | 一句话结论 | 原始证据 |
|------|----------|------------|----------|
| FunASR Paraformer 长音频 | **默认主线** | 长音频、多语段、标点、时间轴与发布侧车均围绕此路线加固。 | [ADR-0003](../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md)、[asr-sidecar-funasr-policy.md](./asr-sidecar-funasr-policy.md) |
| Sherpa ONNX Paraformer | **Partial Go / R&D** | 体积有优势；13min 交叉 CER 约 67%，不能替换长音频主路径。 | [ADR-0006](../adr/0006-sherpa-onnx-paraformer-spike-evaluation.md)、[quant compare](../execution/specs/r3h-3.5-sherpa-quant-compare-report.md) |
| Sherpa ONNX Qwen3 | **Defer / 不进主链路** | 最新金标 A/B 显示 CER 未明显赢，热词有污染，外置标点拖后腿，CPU RTFx 不达默认门槛。 | [R3s-A acceptance](../execution/specs/r3s-a-qwen3-pipeline-hardening-acceptance.md)、[ADR-0007](../adr/0007-sherpa-qwen3-default-asr-engine.md) |
| Qwen3 FunASR | **No-go** | 现有 Rushi segmentation 路径下长/短音频 0 语段，且长音频约 6.5x 慢于 Paraformer。 | [R3g-B results](../execution/specs/r3g-b-qwen3-asr-spike-results.md) |
| Qwen3 + ForcedAligner | **废弃** | ForcedAligner 救活语段，但 CPU wall 约 1338s，约 8x Paraformer；已拍板不做本机第三 SKU。 | [Align results](../execution/specs/r3g-b-align-forced-aligner-spike-results.md) |
| Fun-ASR-Nano PyTorch | **Defer / 不上 catalog** | 全量制控默认路径 0 段 / stub；180s 强制窗可跑 108 段但低于 Paraformer 198 段，且无 `sentence_info`。 | [Nano acceptance](../execution/specs/r3g-c-funasr-nano-acceptance.md)、[Nano results](../execution/specs/r3g-c-funasr-nano-spike-results.md) |
| Fun-ASR-Nano + vLLM | **Defer** | 只适合 CUDA research spike；当前无 NVIDIA CUDA 环境，不进 CPU/MPS 默认侧车。 | [Nano vLLM research](../execution/specs/r3g-c-funasr-nano-vllm-research.md) |
| SenseVoiceSmall | **已弃用** | catalog 已迁移到 Paraformer 长音频；不再作为 Sherpa 或 FunASR Go 门控。 | [ADR-0003 附录 A](../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) |
| SeACo Paraformer | **Defer** | 可跑通且 CER 略优，但 hotwords on/off 零 lift，不能作为热词增强 SKU。 | [SeACo results](../execution/specs/r3g-seaco-paraformer-hotword-spike-results.md) |
| FireRedASR2 | **v1 不接入** | 非 FunASR 生态且 AED 60s 输入限制；仅保留技术雷达。 | [ADR-0003 与 FireRedASR2](../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) |

## 最新 Sherpa Qwen3 A/B

2026-07-19 在同一 D3 gold 音频上复跑 `Silero VAD -> Qwen3-ASR-0.6B INT8 -> optional punctuation`。输出在 `docs/execution/spike-output/qwen3-a-2026-07-19/`，每组含 JSON、`.raw.txt`、`.punctuated.txt`。

| 模式 | 内容 CER | 含标点 CER | 术语命中 | RTFx wall | 判断 |
|------|----------|------------|----------|-----------|------|
| hotwords on / punct off | 11.22% | 19.40% | 100% | 2.20 | 内容最好，但热词命中有污染风险 |
| hotwords on / punct on | 11.22% | 24.89% | 100% | 3.74 | 外置标点拉高错误 |
| hotwords off / punct off | 11.61% | 20.10% | 75% | 2.38 | 最干净模型基线 |
| hotwords off / punct on | 11.61% | 25.64% | 75% | 2.56 | 外置标点仍拖后腿 |

解读：

- **外置 CT-Transformer 标点应关**：Qwen3 原始输出已经带标点，再接外置标点会重复。
- **热词不能直接当成功证据**：已观察到热词被注入开头文本，`term_hit_rate=1.0` 可能是假好看。
- **速度不达默认门槛**：CPU RTFx 约 2.2-2.6，低于 R3s-A 对默认讨论要求的 5.0。
- **ADR-0007 仍为 proposed + Defer**：本页为当前读法；不要据 2026-06-11 proposed 文档直接进入产品 Phase 1-3。

## 为什么 LLM-ASR 暂不替换默认

LLM 式 ASR 的主要优势是多语言、方言、上下文、术语提示与 GPU/vLLM 高并发吞吐。Rushi 当前默认场景是单机 CPU / macOS 或 Windows / 中文长课音频 / 需要稳定 `segments[]` 时间轴。这个场景更看重：

- 单任务长音频 wall time；
- `sentence_info` 或等价稳定语段；
- 标点与热词真实生效；
- 零命令行安装和侧车体积可控；
- 失败时可诊断、可降级。

已有测评显示 Qwen3、Nano、ForcedAligner 等路线的优势未落到这些默认门槛上，因此保留为 R&D，而不进入 catalog 默认项。

## 重开条件

| 路线 | 允许重开时机 | 最小证据 |
|------|--------------|----------|
| Sherpa Qwen3 | 需要继续验证本机内嵌引擎时 | 同一 gold 音频下 content CER 明显优于或接近 Paraformer；RTFx >= 5；无热词污染；标点策略明确 |
| Fun-ASR-Nano + vLLM | 有 Windows/Linux NVIDIA CUDA 机器时 | 不触发 `<\|no\|>`；语段数 >= Paraformer 90%；wall <= 1.5x Paraformer；显存 <= 8GB |
| Sherpa Paraformer | 作为轻量模式重新评估时 | 使用完整 VAD+punc 管线、同 gold CER，而非只用 FunASR 交叉 CER |
| SeACo Paraformer | 重新做热词专项时 | hotwords on/off 有可复现 lift，且不牺牲 CER / segmentation |
| FireRedASR2 | v1 后第三引擎 research | 先解决输入时长、时间轴、体积、生态边界，不直接接产品 |

## 复现入口

| 目的 | 命令 / 入口 |
|------|-------------|
| Sherpa Qwen3 gold A/B | `services\asr\.venv\Scripts\python.exe scripts/eval-sherpa-run.py --hotwords-mode off --punctuation-mode off` |
| Sherpa Paraformer P0 对照 | `bash scripts/r3h-3.5-sherpa-long-compare.sh` |
| Qwen3 FunASR spike | `scripts/r3g-b-qwen3-spike-run.py`、`scripts/r3g-b-qwen3-asr-spike-hand-test.sh` |
| Qwen3 + ForcedAligner | `scripts/r3g-b-align-forced-aligner-spike-hand-test.sh` |
| Fun-ASR-Nano spike | `scripts/r3g-c-funasr-nano-spike-run.py`、`scripts/r3g-c-funasr-nano-spike-hand-test.sh` |
| SeACo hotword spike | [SeACo results](../execution/specs/r3g-seaco-paraformer-hotword-spike-results.md) 中产物与说明 |

## Agent 规则

1. 新 ASR 路线讨论先读本页，再读对应原始 report / ADR。
2. 不要把 **proposed** ADR 当成 accepted 默认路线；看“当前状态”和最新复测。
3. 不要用交叉 CER 代替 gold CER 做产品 Go 结论。
4. 不要只看 term hit；必须检查是否有热词注入、幻觉或文本污染。
5. 不要把 GPU/vLLM 高并发宣传外推到本机 CPU 单任务长音频。

# Intent: R3s-A — Sherpa Qwen3 为将来默认本机 ASR

> **Research**：[r3s-sherpa-qwen3-default-engine-research.md](./r3s-sherpa-qwen3-default-engine-research.md)  
> **Plan**：[r3s-sherpa-qwen3-default-engine-plan.md](./r3s-sherpa-qwen3-default-engine-plan.md)  
> **Acceptance**：[r3s-sherpa-qwen3-default-engine-acceptance.md](./r3s-sherpa-qwen3-default-engine-acceptance.md)  
> **ADR**：[ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md)  
> **执行模式**：**Defer**（[plan §Defer](./r3s-sherpa-qwen3-default-engine-plan.md)）— G1 前不接入产品转写；默认仍为 FunASR Paraformer

## 意图

将 Rushi **本机转写默认路径**从 **FunASR Python 侧车（Paraformer）** 迁移到 **桌面内嵌 Sherpa-ONNX（Qwen3-ASR-0.6B + Silero VAD）**，在保持 `segments[]` / SQLite / 编辑器契约不变的前提下，降低运行时体积依赖、提升 Qwen 路线可用性，并保留 FunASR **回退**直至金标验收通过。

## 用户价值

- 长音频转写 **更快**（spike：与 Paraformer 同级 RTFx，远快于 FunASR Qwen）
- **可分段**（VAD 短语级，无需 ForcedAligner 双模型栈）
- 弱化 **~2.5GB 侧车** 对默认体验的绑定（ORT + ONNX 内嵌）
- 为 **Qwen 多语 / 质量** SKU 留出默认位（非 Paraformer 独占）

## 非目标（本 intent）

- v1 发行瞬间切换默认（必须 phased + feature flag）
- 删除 FunASR 代码库或侧车（EOL 单独 ADR 切片）
- Sherpa Paraformer 作为默认（ADR-0006 已 Partial Go，质量不足）
- 在线 STT / LLM 管线变更
- 标点、说话人、STREAM 一次性全做

## 关键假设

1. 用户将提供 **人工审核金标**（至少制控全轨）作为 Go 闸门。
2. Sherpa Qwen3 ONNX 包经 LRC 分发可接受 **~4–5GB** 磁盘（与现双栈并存期可能更大）。
3. macOS 首平台；Windows 在 Phase 2 前不宣称默认。

## 成功画像（完成时）

- 新用户环境页默认 SKU：**Qwen3 本机转写（ONNX）**
- `project_run_transcribe` 默认走 Rust Sherpa，**不启动** 8741（或 sidecar 可选）
- ACC-EVAL-2 对 Sherpa 列：**CER ≤ Paraformer 基线 + ε**（ε 在 acceptance 定）
- FunASR Paraformer：**设置 → 高级 → 兼容引擎** 可切回
- 远期 **Sherpa 双 SKU**（Qwen 默认 + Paraformer 标点/热词）：见 plan §证据更新、R3h-3.5 P2

# R3g-B-Align — Qwen3 + ForcedAligner 实测记录

> 填表真源：research [§4.1](./r3g-b-align-qwen3-forced-aligner-spike-research.md#41-go--no-go-阈值硬闸门)  
> 手测：[checklist](./r3g-b-align-forced-aligner-spike-hand-test-checklist.md)

## 环境

| 项 | 值 |
|----|-----|
| 日期 | 2026-06-11 |
| 机器 | macOS · CPU（`RUSHI_FUNASR_DEVICE` 默认 cpu） |
| `funasr` | 1.3.9 |
| `RUSHI_FUNASR_MODEL` | `Qwen/Qwen3-ASR-0.6B` |
| `RUSHI_FUNASR_FORCED_ALIGNER` | `Qwen/Qwen3-ForcedAligner-0.6B` |
| `/health` ready | yes · `funasr_loaded_model_id` 非空（warmup 后） |

**Paraformer 对照**（ACC-EVAL-2，2026-06-11）：198 段 · wall 168.2s · RTFx 7.43 · `sentence_info`

**产物**：`docs/execution/spike-output/qwen3-align-2026-06-11/eval-report.json`

## §4.1 指标

| # | 指标 | Paraformer | Qwen+Aligner | 通过？ |
|---|------|------------|--------------|--------|
| A1 | 语段数 ≥10 | 198 | **211** | ✅ |
| A2 | ≥ max(15, 90%×198) ≈ 177 | 198 | **211** | ✅ |
| A4 | `segmentation_mode` | sentence_info | **vad_timestamp** | ✅ |
| A5 | term_hit | 1.0 | **1.0** | ✅ |
| A8 | wall ≤2× Paraformer (~336s) | 168s | **1337.7s** (~8×) | ❌ |

## 结论

- [ ] **Go** → 允许起草 R3g-B catalog intent  
- [x] **Defer** → blocker：**同机 CPU wall ~1338s（RTFx 0.93），远超 §4.1 A8（310s Go / ~466s Defer 上限）；需 GPU 或性能薄片后再进 catalog**  
- [ ] **No-go** → 理由：

**一句话**：ForcedAligner 已救活长音频语段（211 段、term_hit 1.0），加载链路与 warmup 已通；**CPU 耗时不可接受**，暂不产品化 catalog。

## 产品拍板（2026-06-18）

**R3g-B-Align / Qwen3 本机第三 SKU 路径废弃，不再做。** Spike 已 Defer（A8 未过）；无 GPU 性能薄片计划。本机 catalog **维持 Paraformer 单 SKU**；`RUSHI_FUNASR_FORCED_ALIGNER` env 保留为 spike 存档，**不进 catalog**。

## 代码修复摘要（本 run）

| 问题 | 修复 |
|------|------|
| FunASR `model=` 传本地路径 → not registered | Qwen ASR 用 hub id + `hub=ms`（`resolve_funasr_automodel_arg`） |
| ForcedAligner hub id → transformers 找不到权重 | Aligner 用本地 ModelScope 路径（`resolve_qwen_forced_aligner_arg`） |
| preflight Python f-string 语法错误 | heredoc + `HEALTH_JSON` |
| eval curl 无 `--max-time` | `eval-run.py` 与 subprocess 超时对齐 |

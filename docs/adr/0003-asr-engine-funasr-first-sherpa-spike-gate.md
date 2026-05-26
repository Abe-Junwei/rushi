---
adr: "0003"
title: ASR 引擎路线 — 先 FunASR 侧车 + LRC，Sherpa-ONNX 经 Spike 门控
status: accepted
date: 2026-05-26
---

# ADR-0003：ASR 引擎路线 — 方案 A（FunASR 先行，Sherpa 门控）

## 上下文

Rushi 本机 ASR 当前为 **PyInstaller FunASR 侧车**（`127.0.0.1:8741`），存在：

- 构建 fragile（如 `funasr` 包数据未收集导致 `/health` 500）
- 运行时 ~2.5GB，分发与签名成本高
- 发行用户需 **零命令行** 安装路径（R3h LRC 整改）

**Sherpa-ONNX** 可通过 Rust `sherpa-onnx` crate 内嵌推理，体积更小，且官方支持 SenseVoice / 离线 Paraformer。审查报告与产品讨论提出三条路径：

| 方案 | 概要 |
|------|------|
| **A** | R3h-0～3 继续 FunASR + LRC；**R3h-3.5** 做 1 周 Sherpa Spike；通过后再规划迁移 |
| **B** | 跳过 FunASR 修复，直接 Sherpa 为 v1 引擎 |
| **C** | R3h-0 与 Sherpa Spike 并行（需多人） |

调研结论见对话记录与 [`rushi-local-runtime-catalog-remediation-plan-review.md`](../execution/specs/rushi-local-runtime-catalog-remediation-plan-review.md) §5。

## 决策

**采用方案 A**（2026-05-26 产品确认）。

1. **v1 发行阻塞线**：按 [`rushi-execution-roadmap.md`](../execution/plans/rushi-execution-roadmap.md) **§4.1.1** 执行 **R3h-0 → R3h-1 → R3f 手测 → …**，不推迟以等待 Sherpa。
2. **LRC 与引擎解耦**：manifest / installer / 就绪状态机 **不绑定** FunASR；未来 runtime 可换为 Sherpa 二进制或 ONNX 模型包。
3. **Sherpa 不提前全面替换**：在 **R3h-3（环境与能力就绪）之后** 执行 **R3h-3.5 Spike**（约 1 周）；Spike 通过前 **不得** 删除 FunASR 侧车主路径。
4. **Spike 通过后**：另开 ADR 或修订本 ADR，定义 `asr_engine`（`funasr-sidecar` | `sherpa-onnx`）及迁移切片；优先 **保留 HTTP 契约** 或 Rust 内薄兼容层，避免桌面大改。
5. **Spike 不通过**：在 [`asr-sidecar-funasr-policy.md`](../architecture/asr-sidecar-funasr-policy.md) 明示 ~2.5GB Python 侧车为长期约束，持续加固 PyInstaller + LRC。

## 明确不做（本 ADR 有效期内）

- **方案 B**：以 Sherpa 为唯一 v1 引擎并跳过 R3h-0/1 FunASR 发行止血
- **方案 C**：单人排期下 R3h-0 与 Sherpa 全量实现并行
- 在 Spike 完成前移除 `services/asr` 侧车或 ModelScope `prepare` 主路径

## 后果

### 正面

- 最快恢复「可安装、可 health、可一键准备」的发行路径
- R3f / R3e-A / R3g-A 可沿用已编码与 FunASR Hub id
- LRC 投资不因引擎切换作废
- Sherpa 决策基于实测 CER、语段、热词、Win/mac GPU，而非假设

### 负面 / 风险

- 短期仍承担 ~2.5GB 侧车体积与 PyInstaller 维护（至 Spike 结论）
- 若 Spike 通过，需规划 **第二段迁移工程**（估计 2～4 周，另列 acceptance）
- Fun-ASR-Nano 等 SKU 可能在 Sherpa 路径上不可用，迁移时需产品取舍

## 验证（方案 A 各阶段）

| 阶段 | 完成标准 |
|------|----------|
| R3h-0 | post-build health smoke；`sidecarIntegrity`；Win 磁盘诊断 |
| R3h-1 | 应用内下载侧车 + app_data 解析；零终端手测 |
| R3f | 一键准备签收（在 R3h-0 后） |
| R3h-3.5 | Spike 报告 + CER/语段对比 + GPU smoke；结论写入 ADR 附录或新 ADR |

## 参考

- [`rushi-local-runtime-catalog-remediation-plan.md`](../execution/specs/rushi-local-runtime-catalog-remediation-plan.md) v1.1
- [`r3g-local-asr-model-catalog-acceptance.md`](../execution/specs/r3g-local-asr-model-catalog-acceptance.md)
- [sherpa-onnx SenseVoice Rust 示例](https://github.com/k2-fsa/sherpa-onnx/blob/master/rust-api-examples/examples/sense_voice.rs)

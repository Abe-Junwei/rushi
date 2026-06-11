---
adr: "0007"
title: Sherpa-ONNX Qwen3 为将来默认本机 ASR 引擎（phased 迁移）
status: proposed
date: 2026-06-11
supersedes: null
related: ["0003", "0006"]
---

# ADR-0007：Sherpa Qwen3 默认引擎迁移

## 上下文

- [ADR-0003](./0003-asr-engine-funasr-first-sherpa-spike-gate.md) 锁定 **FunASR + LRC 先行**；附录 A 预期 Sherpa **轻量候选**，默认仍 Paraformer。
- [ADR-0006](./0006-sherpa-onnx-paraformer-spike-evaluation.md)：**Sherpa Paraformer** Partial Go — **不能**替长音频主路径。
- **2026-06-11 spike**：**Sherpa Qwen3-0.6B + Silero VAD** 在制控全轨 **162s / 270 段 / RTFx ~7.7 / term_hit 1.0**；FunASR Qwen+Aligner **Defer**（1338s、Aligner 轴差）。
- 产品决策：**走将来默认** Sherpa Qwen 路线（非 Paraformer ONNX）。

Research：[r3s-sherpa-qwen3-default-engine-research.md](../execution/specs/r3s-sherpa-qwen3-default-engine-research.md)

## 决策

1. **目标态**：本机转写默认 = **桌面内嵌 sherpa-onnx（Qwen3-ASR-0.6B INT8 + Silero VAD）**；HTTP 8741 FunASR 侧车 **降级为兼容回退**，非立即删除。
2. **迁移**：四阶段（金标闸门 → Rust 内嵌 flag → LRC+catalog 双轨 → 默认切换）；详见 [plan](../execution/specs/r3s-sherpa-qwen3-default-engine-plan.md)。
3. **不作为默认**：Sherpa Paraformer-only（ADR-0006）；FunASR Qwen+ForcedAligner CPU 路径。
4. **分段真源**：Rust 层产出与现 `segments[]` 同形 JSON；**禁止**第二套 SQLite 写入路径。
5. **Go 闸门**：金标 CER + ACC-EVAL + G1–G8（acceptance）；**未过不得 Phase 3**。
6. **标点**：Phase 3 前允许 **无标点** ship，须在 catalog/UI 明示；后续 LLM 或独立薄片。

## 后果

### 正面

- 默认路径摆脱 ~2.5GB Python 侧车强依赖
- Qwen SKU 工程可行（相对 FunASR Qwen 栈）
- 与 LRC「引擎无关」方向一致（manifest 扩 ONNX）

### 负面

- 双栈并存期磁盘可能 **PyTorch + ONNX** 并存
- 团队需维护 Rust ASR + 过渡期 FunASR
- 无标点直至后续薄片

## 状态

**proposed** — 待 Phase 0 金标 + Phase 1 落地后改 **accepted**（Phase 3 前）。

## 验证

| 阶段 | 证据 |
|------|------|
| Spike | `docs/execution/spike-output/qwen3-sherpa-retest-2026-06-11/` |
| Phase 0 | 金标 CER 报告 |
| Phase 1 | `asr_sherpa` tests + 手测 |
| Phase 3 | acceptance G1–G8 |

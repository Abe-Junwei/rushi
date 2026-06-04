# 并行薄片索引（不挡 v1 后主序 · 2026-06-04）

> **主序真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10  
> **纪律**：每轮仍 **一轮一薄片**；下列项 **勿与 ⑤″f-B 或 LLM Gate 填表同 PR 大改**

## 当前主序阻塞项（须先完成）

| 项 | 状态 | 动作 |
|----|------|------|
| **⑤″f-A 尾项** | 🟡 机器✅ 手测⏳ | R3t-E + F2 桌面手测 → [`r3-5f-a-phase-signoff-2026-06.md`](./r3-5f-a-phase-signoff-2026-06.md) |
| **Gate-A G-A1** | ⏳ 可选 | 20 段人工可接受表 — [`llm-loc-spike-results-2026-06.md`](./llm-loc-spike-results-2026-06.md) |
| **Gate-B / 4b** | ❌ No-Go | [`llm-loc-gate-b-decision-2026-06.md`](./llm-loc-gate-b-decision-2026-06.md) |

## 并行候选（路线图 §10 · 不挡 Spike/4a）

| ID | 主题 | 预估 | 状态 | 规格 / 验收 | 启动条件 |
|----|------|------|------|-------------|----------|
| **R3h-0** | 构建 smoke + Win 磁盘 + pip UI 降级 | 2–3d | 🟡 | [remediation §5 Phase 0](./rushi-local-runtime-catalog-remediation-plan.md) | 可与 ⑤″f-A 并行；**勿**在 R3h-0 未闭环时签收 R3f |
| **TRN-DIAG** | 转写阶段时间线 + 诊断包 | 0.5w | 📋 | [`trn-diag-acceptance.md`](./trn-diag-acceptance.md) | R3t-B ✅ 后；与 ⑤″f 不同目录 |
| **ASR-WARM** | 侧车保活、模型预热 | 0.5–1w | 📋 | [`asr-warm-acceptance.md`](./asr-warm-acceptance.md) | R3t-B ✅；R3h-I1 FSM 设计冻结后 |
| **R3h-2** | 断点续传、GC、C 类升级回滚 | ~1w | ⏳ | remediation §5 Phase 2 | ⑦ 发行成熟轨；**4b 重开 Gate-B 前置** |

## 禁忌（§4.1.3）

- **勿** R3f 大改与 R3e-B 分片同轮  
- **勿** Gate-B 未过即改 `llm-runtime` catalog  
- **勿** ⑤″f-A 手测未签即开 MEM-P0 编码（路线图：⑤″f-B 在 A 闭合后）

## 推荐空档顺序（单人）

```text
1. ⑤″f-A 手测（1 次 desktop:dev 会话，~45min）
2. ⑤″f-B 薄片（F1 + F6 + MEM-P0）
3. 空档二选一：R3h-0 smoke 专轮 | TRN-DIAG 0.5w
4. LLM：G-A1 人工表（可选，不挡 ⑤″f-B）
```

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-04 | 初版：对齐路线图 §10 并行表 + Gate-B No-Go |
